import { searchAllPapers, searchOpenAlexAuthors, searchOpenAlexInstitutions } from '@/lib/eyra-api';
import { supabaseEntities } from '@/services/supabase-entities';

const KEYS = { watchlists: 'eylo_watchlists_v1', discoveries: 'eylo_monitoring_discoveries_v1', notifications: 'eylo_notifications_v1' };
const EVENT = 'eylo:monitoring-updated';

const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent(EVENT)); return value; };
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
let hydrationPromise;

const repositories = {
  watchlists: supabaseEntities.Watchlist,
  discoveries: supabaseEntities.MonitoringDiscovery,
  notifications: supabaseEntities.Notification,
};

function notify() { window.dispatchEvent(new CustomEvent(EVENT)); }

async function hydrateFromSupabase() {
  try {
    const [watchlists, discoveries, notifications] = await Promise.all([
      repositories.watchlists.list('-updated_date', 100),
      repositories.discoveries.list('-created_date', 300),
      repositories.notifications.list('-created_date', 100),
    ]);
    localStorage.setItem(KEYS.watchlists, JSON.stringify(watchlists));
    localStorage.setItem(KEYS.discoveries, JSON.stringify(discoveries));
    localStorage.setItem(KEYS.notifications, JSON.stringify(notifications));
    notify();
  } catch (error) {
    // The local cache remains usable while a new Supabase migration is being
    // applied or when the user is temporarily offline.
    console.warn('[monitoring] Supabase sync unavailable; using local cache.', error?.message || error);
  }
}

function hydrate() {
  hydrationPromise ||= hydrateFromSupabase().finally(() => { hydrationPromise = null; });
  return hydrationPromise;
}

function persistCreate(bucket, temporaryId, payload) {
  repositories[bucket].create(payload).then(created => {
    const current = read(KEYS[bucket]);
    write(KEYS[bucket], current.map(item => item.id === temporaryId ? created : item));
  }).catch(() => {});
}

function persistUpdate(bucket, itemId, patch) {
  if (!String(itemId).includes('-') || String(itemId).split('-').length < 5) return;
  repositories[bucket].update(itemId, patch).catch(() => {});
}

export const monitoringStore = {
  watchlists: () => read(KEYS.watchlists),
  discoveries: () => read(KEYS.discoveries),
  notifications: () => read(KEYS.notifications),
  hydrate,
  subscribe(callback) { window.addEventListener(EVENT, callback); void hydrate(); return () => window.removeEventListener(EVENT, callback); },
  addWatchlist(input) {
    const item = { id: id(), type: input.type || 'topic', query: input.query.trim(), active: true, createdAt: new Date().toISOString(), lastCheckedAt: null };
    const result = write(KEYS.watchlists, [item, ...read(KEYS.watchlists)]);
    const { id: _id, ...payload } = item; persistCreate('watchlists', item.id, payload); return result;
  },
  updateWatchlist(itemId, patch) { persistUpdate('watchlists', itemId, patch); return write(KEYS.watchlists, read(KEYS.watchlists).map(item => item.id === itemId ? { ...item, ...patch } : item)); },
  deleteWatchlist(itemId) { if (String(itemId).split('-').length >= 5) repositories.watchlists.delete(itemId).catch(() => {}); return write(KEYS.watchlists, read(KEYS.watchlists).filter(item => item.id !== itemId)); },
  updateDiscovery(itemId, patch) { persistUpdate('discoveries', itemId, patch); return write(KEYS.discoveries, read(KEYS.discoveries).map(item => item.id === itemId ? { ...item, ...patch } : item)); },
  markNotification(itemId, patch) { persistUpdate('notifications', itemId, patch); return write(KEYS.notifications, read(KEYS.notifications).map(item => item.id === itemId ? { ...item, ...patch } : item)); },
  markAllRead() { const items = read(KEYS.notifications).map(item => ({ ...item, read: true })); items.forEach(item => persistUpdate('notifications', item.id, { read: true })); return write(KEYS.notifications, items); },
};

function confidence(entity, kind) {
  if (kind === 'paper') {
    const citations = entity.cited_by_count || 0;
    const age = entity.year ? new Date().getFullYear() - entity.year : 20;
    const score = Math.min(98, 45 + Math.min(35, Math.log10(citations + 1) * 15) + Math.max(0, 18 - age * 2));
    return { score: Math.round(score), label: score >= 75 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW' };
  }
  const signal = kind === 'researcher' ? (entity.citation_count || 0) + (entity.works_count || 0) : entity.works_count || 0;
  const score = Math.min(95, 45 + Math.log10(signal + 1) * 14);
  return { score: Math.round(score), label: score >= 75 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW' };
}

function normalize(entity, kind, watchlist) {
  const conf = confidence(entity, kind);
  const priority = conf.score >= 80 ? 'HIGH' : conf.score >= 60 ? 'MEDIUM' : 'LOW';
  return {
    id: id(), externalId: entity.id, watchlistId: watchlist.id, watchQuery: watchlist.query,
    type: kind, title: entity.title || entity.name, description: entity.summary || entity.research_areas || `${entity.type || 'Research institution'} in ${entity.country || 'an international network'}`,
    source: kind === 'paper' ? entity.source : 'OpenAlex', sourceUrl: entity.url || entity.profile_url,
    authors: entity.authors, institution: entity.institution, year: entity.year,
    priority, confidence: conf.label, confidenceScore: conf.score,
    priorityReason: priority === 'HIGH' ? 'Strong evidence and research-impact signals' : 'Relevant to this watchlist query',
    evidence: kind === 'paper' ? `${entity.cited_by_count || 0} citations · ${entity.year || 'year unavailable'}` : `${entity.works_count || 0} works`,
    recommendedAction: kind === 'paper' ? 'Review the source and save it to your research library.' : kind === 'researcher' ? 'Review the profile and assess collaboration fit.' : 'Explore the institution and relevant research groups.',
    detectedAt: new Date().toISOString(), dismissed: false, saved: false,
  };
}

export async function runWatchlist(watchlist) {
  const [papers, researchers, institutions] = await Promise.all([
    searchAllPapers(watchlist.query), searchOpenAlexAuthors(watchlist.query, 6), searchOpenAlexInstitutions(watchlist.query, 4),
  ]);
  const candidates = [...papers.map(x => normalize(x, 'paper', watchlist)), ...researchers.map(x => normalize(x, 'researcher', watchlist)), ...institutions.map(x => normalize(x, 'institution', watchlist))];
  const existing = read(KEYS.discoveries);
  const known = new Set(existing.map(item => `${item.source}|${item.externalId}`));
  const fresh = candidates.filter(item => item.externalId && !known.has(`${item.source}|${item.externalId}`));
  write(KEYS.discoveries, [...fresh, ...existing].slice(0, 300));
  fresh.forEach(item => { const { id: temporaryId, ...payload } = item; persistCreate('discoveries', temporaryId, payload); });
  const notifications = fresh.filter(item => item.priority === 'HIGH').map(item => ({ id: id(), discoveryId: item.id, title: item.title, description: item.priorityReason, priority: item.priority, type: item.type, sourceUrl: item.sourceUrl, read: false, createdAt: item.detectedAt }));
  write(KEYS.notifications, [...notifications, ...read(KEYS.notifications)].slice(0, 100));
  notifications.forEach(item => { const { id: temporaryId, ...payload } = item; persistCreate('notifications', temporaryId, payload); });
  monitoringStore.updateWatchlist(watchlist.id, { lastCheckedAt: new Date().toISOString() });
  return { discovered: fresh.length, notifications: notifications.length };
}

export async function runAllWatchlists() {
  const active = monitoringStore.watchlists().filter(item => item.active);
  const results = await Promise.all(active.map(runWatchlist));
  return results.reduce((total, result) => ({ discovered: total.discovered + result.discovered, notifications: total.notifications + result.notifications }), { discovered: 0, notifications: 0 });
}
