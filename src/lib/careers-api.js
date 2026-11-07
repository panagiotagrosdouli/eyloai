const API_BASE = import.meta.env?.BASE_URL === '/eyloai/'
  ? 'https://eyloai.vercel.app'
  : '';

export async function searchCareers(query, page = 0, signal) {
  const cleanQuery = String(query || '').trim().slice(0, 180);
  if (cleanQuery.length < 2) throw new Error('Enter at least two characters to search research roles.');
  const params = new URLSearchParams({ q: cleanQuery, page: String(page) });
  const response = await fetch(API_BASE + '/api/euraxess?' + params.toString(), {
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
