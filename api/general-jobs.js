const FEEDS = [
  { source: 'Arbeitnow Europe', url: 'https://www.arbeitnow.com/api/job-board-api?page=1', region: 'Europe' },
  { source: 'Arbeitnow UK', url: 'https://www.arbeitnow.co.uk/api/job-board-api?page=1', region: 'United Kingdom' },
];
const REMOTIVE_FEED_URL = 'https://raw.githubusercontent.com/panagiotagrosdouli/eyloai/career-feed/remotive-jobs.json';
const TIMEOUT_MS = 10000;
const MAX_ITEMS_PER_FEED = 50;
const MAX_REMOTIVE_ITEMS = 100;

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
.replace(/&#(\d+);/g, (_, number) => {
      const codePoint = Number(number);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => {
      const codePoint = parseInt(number, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' ';
    });
}

function plainText(value = '') {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizeRemotiveJob(job) {
  try {
    const sourceUrl = new URL(job?.source_url || job?.url);
    if (sourceUrl.protocol !== 'https:' || !['remotive.com', 'www.remotive.com'].includes(sourceUrl.hostname.toLowerCase())) return null;
    const title = plainText(job?.title || '');
    const id = String(job?.id || '').trim();
    if (!title || !id) return null;
    return {
      id,
      title,
      organization: plainText(job?.organization || job?.company_name || ''),
      country: plainText(job?.country || job?.candidate_required_location || 'Remote'),
      description: plainText(job?.description || '').slice(0, 700),
      deadline: '',
      source: 'Remotive',
      source_url: sourceUrl.toString(),
    };
  } catch {
    return null;
  }
}

async function loadRemotiveJobs() {
  const upstream = await fetch(REMOTIVE_FEED_URL, {
    headers: { accept: 'application/json', 'user-agent': 'EYLO career listings' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!upstream.ok) throw new Error('Remotive snapshot returned ' + upstream.status);
  const snapshot = await upstream.json();
  if (snapshot?.source !== 'Remotive' || !Array.isArray(snapshot?.items)) {
    throw new Error('Remotive snapshot is invalid.');
  }
  return snapshot.items.slice(0, MAX_REMOTIVE_ITEMS).map(normalizeRemotiveJob).filter(Boolean);
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

  const sourceNames = [...FEEDS.map(feed => feed.source), 'Remotive'];
  const requests = [
    ...FEEDS.map(async feed => {
      const upstream = await fetch(feed.url, {
        headers: { accept: 'application/json', 'user-agent': 'EYLO career listings' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!upstream.ok) throw new Error(feed.source + ' returned ' + upstream.status);
      const payload = await upstream.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];
      return data.slice(0, MAX_ITEMS_PER_FEED).map(job => normalizeJob(job, feed)).filter(Boolean);
    }),
    loadRemotiveJobs(),
  ];
  const results = await Promise.allSettled(requests);
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const failed = results.flatMap((result, index) => result.status === 'rejected' ? [sourceNames[index]] : []);
  if (!items.length) {
    return response.status(502).json({
      error: 'Free general career listings are temporarily unavailable.',
      failed_sources: failed,
    });
  }

  response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=43200');
  return response.status(200).json({
    source: 'Arbeitnow and Remotive',
    coverage: ['Europe', 'United Kingdom', 'global remote roles subject to each listing’s location rules'],
    retrieved_at: new Date().toISOString(),
    attribution_url: 'https://www.arbeitnow.com/',
    remotive_attribution_url: 'https://remotive.com/remote-jobs/api',
    remotive_provider_delay_hours: 24,
    items,
    failed_sources: failed,
  });
}
