const FEEDS = [
  { source: 'Arbeitnow Europe', url: 'https://www.arbeitnow.com/api/job-board-api?page=1', region: 'Europe' },
  { source: 'Arbeitnow UK', url: 'https://www.arbeitnow.co.uk/api/job-board-api?page=1', region: 'United Kingdom' },
];
const TIMEOUT_MS = 10000;
const MAX_ITEMS_PER_FEED = 50;

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)));
}

function plainText(value = '') {
  return decodeEntities(String(value)
    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\\s+/g, ' ')).trim();
}
function safePostingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)arbeitnow\.(com|co\.uk)$/i.test(url.hostname)
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function normalizeJob(job, feed) {
  const sourceUrl = safePostingUrl(job.url);
  const title = plainText(job.title || '');
  if (!sourceUrl || !title) return null;
  return {
    id: feed.source.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + String(job.slug || job.id || sourceUrl),
    title,
    organization: plainText(job.company_name || ''),
    country: plainText(job.location || feed.region),
    description: plainText(job.description || '').slice(0, 700),
    deadline: '',
    source: feed.source,
    source_url: sourceUrl,
  };
}

function setCors(response, origin = '') {
  const allowed = new Set([
    'https://panagiotagrosdouli.github.io',
    'https://eyloai.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  try {
    const hostname = new URL(origin).hostname;
    if (allowed.has(origin) || /\.vercel\.app$/i.test(hostname)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
  } catch {
    // Requests without an Origin header do not need CORS headers.
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(request, response) {
  setCors(response, String(request.headers.origin || ''));
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const results = await Promise.allSettled(FEEDS.map(async feed => {
    const upstream = await fetch(feed.url, {
      headers: { accept: 'application/json', 'user-agent': 'EYLO career listings' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) throw new Error(feed.source + ' returned ' + upstream.status);
    const payload = await upstream.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    return data.slice(0, MAX_ITEMS_PER_FEED).map(job => normalizeJob(job, feed)).filter(Boolean);
  }));

  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const failed = results.flatMap((result, index) => result.status === 'rejected' ? [FEEDS[index].source] : []);
  if (!items.length) {
    return response.status(502).json({
      error: 'Free general career listings are temporarily unavailable.',
      failed_sources: failed,
    });
  }

  response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=43200');
  return response.status(200).json({
    source: 'Arbeitnow',
    coverage: ['Europe', 'United Kingdom'],
    retrieved_at: new Date().toISOString(),
    attribution_url: 'https://www.arbeitnow.com/',
    items,
    failed_sources: failed,
  });
}
