import { apiUrl } from '@/lib/api-url';
const REMOTIVE_SNAPSHOT_URL = 'https://raw.githubusercontent.com/panagiotagrosdouli/eyloai/career-feed/remotive-jobs.json';
const REMOTIVE_ATTRIBUTION_URL = 'https://remotive.com/remote-jobs/api';

export async function searchCareers(query, page = 0, signal) {
  const cleanQuery = String(query || '').trim().slice(0, 180);
  if (cleanQuery.length < 2) throw new Error('Enter at least two characters to search research roles.');
  const params = new URLSearchParams({ q: cleanQuery, page: String(page) });
  const response = await fetch(apiUrl('/api/euraxess?' + params.toString()), {
    headers: { accept: 'application/json' },
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Research role search is unavailable.');
  return { ...result, items: Array.isArray(result.items) ? result.items : [] };
}

const STOP_WORDS = new Set(('about after again against all also among another around because been before being between both ' +
  'could each from have into itself more most other over same some such than that their them then there these they ' +
  'this those through under until very what when where which while with within your yours researcher research position ' +
  'experience skills ability knowledge role work team candidate application university project').split(/\s+/));

export function cvSearchTerms(text, limit = 6) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z-]{3,}/g) || [];
  const counts = new Map();
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

export function rankCareers(items, cvText) {
  const words = [...new Set((String(cvText || '').toLowerCase().match(/[a-z][a-z-]{3,}/g) || [])
    .filter(word => !STOP_WORDS.has(word)))];
  return items.map(item => {
    const searchable = (item.title + ' ' + item.organization + ' ' + item.description).toLowerCase();
    const overlaps = words.filter(word => searchable.includes(word)).slice(0, 8);
    return { ...item, match_terms: overlaps, match_score: words.length ? Math.round(overlaps.length / Math.min(words.length, 8) * 100) : null };
  }).sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
}


export function normalizeRemotiveSnapshot(snapshot) {
  if (snapshot?.source !== 'Remotive' || !Array.isArray(snapshot.items) || !snapshot.retrieved_at) {
    throw new Error('Remotive snapshot is invalid.');
  }

  const items = snapshot.items.slice(0, 100).flatMap(job => {
    try {
      const sourceUrl = new URL(job?.source_url || job?.url);
      if (sourceUrl.protocol !== 'https:' || !['remotive.com', 'www.remotive.com'].includes(sourceUrl.hostname.toLowerCase())) return [];
      const title = String(job?.title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
      const id = String(job?.id || '').trim().slice(0, 180);
      if (!title || !id) return [];
      return [{
        id,
        title,
        organization: String(job?.organization || job?.company_name || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
        country: String(job?.country || job?.candidate_required_location || 'Remote').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
        description: String(job?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700),
        deadline: '',
        source: 'Remotive',
        source_url: sourceUrl.toString(),
      }];
    } catch {
      return [];
    }
  });
  if (!items.length) throw new Error('Remotive snapshot has no usable listings.');
  return { items, retrieved_at: snapshot.retrieved_at };
}

async function loadRemotiveSnapshot(signal) {
  const response = await fetch(REMOTIVE_SNAPSHOT_URL, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error('Remotive snapshot returned ' + response.status);
  return normalizeRemotiveSnapshot(await response.json());
}

export async function loadGeneralCareerListings(signal) {
  const [generalResult, remotiveResult] = await Promise.allSettled([
    (async () => {
      const response = await fetch(apiUrl('/api/general-jobs'), {
        headers: { accept: 'application/json' },
        signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'General career listings are unavailable.');
      return { ...result, items: Array.isArray(result.items) ? result.items : [] };
    })(),
    loadRemotiveSnapshot(signal),
  ]);

  const general = generalResult.status === 'fulfilled' ? generalResult.value : null;
  const snapshot = remotiveResult.status === 'fulfilled' ? remotiveResult.value : null;
  const apiItems = general?.items || [];
  const remoteApiItems = apiItems.filter(item => item.source === 'Remotive');
  const remoteItems = remoteApiItems.length ? remoteApiItems : (snapshot?.items || []);
  if (!general && !snapshot) {
    throw new Error('General career listings are unavailable.');
  }

  const failedSources = new Set(general?.failed_sources || []);
  if (!general) failedSources.add('General listings');
  if (remoteItems.length) failedSources.delete('Remotive');
  else failedSources.add('Remotive');
  const seen = new Set();
  const items = [...apiItems.filter(item => item.source !== 'Remotive'), ...remoteItems]
    .filter(item => {
      const key = String(item.id || item.source_url || item.title || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    ...(general || {}),
    source: general?.source || 'Remotive',
    retrieved_at: [general?.retrieved_at, snapshot?.retrieved_at].filter(Boolean).sort().at(-1) || '',
    remotive_attribution_url: REMOTIVE_ATTRIBUTION_URL,
    remotive_provider_delay_hours: 24,
    remotive_snapshot_retrieved_at: snapshot?.retrieved_at || general?.remotive_snapshot_retrieved_at || null,
    failed_sources: [...failedSources],
    items,
  };
}

export function filterCareerListings(items, query) {
  const terms = String(query || '').toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) || [];
  if (!terms.length) return [];
  return items.filter(item => {
    const searchable = [item.title, item.organization, item.country, item.description]
      .join(' ')
      .toLowerCase();
    return terms.some(term => searchable.includes(term));
  });
}
