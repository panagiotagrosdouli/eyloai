const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const OPENALEX_URL = 'https://api.openalex.org/works';
const GRANTS_URL = 'https://api.grants.gov/v1/api/search2';
const MAX_WATCHLISTS_PER_RUN = 30;

function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function headers() {
  const key = supabaseServerKey();
  const result = {
    apikey: key,
    'content-type': 'application/json',
  };
  if (!key.startsWith('sb_')) result.authorization = `Bearer ${key}`;
  return result;
}

async function supabase(path, options = {}) {
  const url = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Supabase ${path} failed: ${response.status}`);
  if (response.status === 204) return null;
  return response.json();
}

function abstractFromInverted(index) {
  if (!index) return '';
  const words = [];
  Object.entries(index).forEach(([word, positions]) => positions.forEach(position => { words[position] = word; }));
  return words.filter(Boolean).join(' ').slice(0, 500);
}

async function searchOpenAlex(query) {
  const params = new URLSearchParams({
    search: query,
    per_page: '5',
    sort: 'publication_date:desc',
  });
  const contactEmail = String(
    process.env.RESEARCH_CONTACT_EMAIL
    || process.env.VITE_RESEARCH_CONTACT_EMAIL
    || '',
  ).trim();
  if (contactEmail) params.set('mailto', contactEmail);
  const response = await fetch(`${OPENALEX_URL}?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`OpenAlex failed: ${response.status}`);
  const payload = await response.json();
  return (payload.results || []).map(work => ({
    external_id: work.id,
    type: 'paper',
    title: work.title || 'Untitled paper',
    summary: abstractFromInverted(work.abstract_inverted_index),
    source: work.primary_location?.source?.display_name || 'OpenAlex',
    source_url: work.doi || work.id,
    published_at: work.publication_date || '',
    priority: 'medium',
  }));
}

function daysUntil(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.ceil((time - Date.now()) / 86_400_000) : null;
}

async function searchGrants(query) {
  const response = await fetch(GRANTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows: 5, keyword: query, oppStatuses: 'forecasted|posted' }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Grants.gov failed: ${response.status}`);
  const payload = await response.json();
  return (payload.data?.oppHits || []).map(hit => {
    const remaining = daysUntil(hit.closeDate);
    return {
      external_id: `grants:${hit.id}`,
      type: 'opportunity',
      title: hit.title || 'Untitled opportunity',
      summary: `${hit.agency || hit.agencyName || 'Official funding notice'} · deadline ${hit.closeDate || 'not listed'}`,
      source: 'Grants.gov',
      source_url: `https://www.grants.gov/search-results-detail/${hit.id}`,
      published_at: hit.openDate || '',
      deadline: hit.closeDate || '',
      priority: remaining !== null && remaining >= 0 && remaining <= 45 ? 'high' : 'medium',
    };
  });
}

async function processWatchlist(row, seen) {
  const data = row.data || {};
  const query = String(data.query || '').trim();
  if (!query || data.active === false) return { inserted: 0, notifications: 0 };

  const records = data.type === 'funding program'
    ? await searchGrants(query)
    : await searchOpenAlex(query);
  let inserted = 0;
  let notifications = 0;

  for (const record of records) {
    const key = `${row.user_id}:${record.external_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const discovery = {
      watchlistId: row.id,
      watchlistQuery: query,
      watchlistType: data.type || 'topic',
      ...record,
      discoveredAt: new Date().toISOString(),
      evidence: `Scheduled source check from ${record.source}`,
      isNew: true,
    };
    await supabase('monitoring_discoveries', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: row.user_id, data: discovery }),
    });
    inserted += 1;

    if (record.priority === 'high') {
      await supabase('notifications', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: row.user_id,
          data: {
            title: 'Time-sensitive funding match',
            message: record.title,
            type: 'opportunity',
            priority: 'high',
            source_url: record.source_url,
            read: false,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      notifications += 1;
    }
  }

  await supabase(`watchlists?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ data: { ...data, lastCheckedAt: new Date().toISOString(), lastResultCount: records.length } }),
  });
  return { inserted, notifications };
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Cron authorization required.' });
  }
  if (!supabaseServerKey()) {
    return response.status(503).json({ error: 'Scheduled monitoring needs a Supabase server key.' });
  }

  try {
    const [watchlists, discoveries] = await Promise.all([
      supabase(`watchlists?select=id,user_id,data&order=updated_date.asc&limit=${MAX_WATCHLISTS_PER_RUN}`),
      supabase('monitoring_discoveries?select=user_id,data&order=created_date.desc&limit=5000'),
    ]);
    const seen = new Set((discoveries || []).map(row => `${row.user_id}:${row.data?.external_id}`));
    let inserted = 0;
    let notifications = 0;
    let failed = 0;

    for (let index = 0; index < watchlists.length; index += 5) {
      const batch = watchlists.slice(index, index + 5).filter(row => row.data?.active !== false);
      const results = await Promise.allSettled(batch.map(row => processWatchlist(row, seen)));
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          inserted += result.value.inserted;
          notifications += result.value.notifications;
        } else {
          failed += 1;
        }
      });
    }

    return response.status(200).json({
      checked: watchlists.length,
      inserted,
      notifications,
      failed,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Scheduled monitoring failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return response.status(500).json({ error: 'Scheduled monitoring failed.' });
  }
}
