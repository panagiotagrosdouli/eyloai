import { applyCors } from '../src/lib/api-cors.mjs';
const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const GRANTS_SEARCH_URL = 'https://api.grants.gov/v1/api/search2';
const GRANTS_DETAIL_URL = 'https://api.grants.gov/v1/api/fetchOpportunity';
const EU_SEARCH_URL = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QOF_tW8ve4IFUsflluOhww_aRubMF0V';
const MAX_QUERY_LENGTH = 240;
const MAX_RESULTS = 15;

async function authenticate(authorization) {
  if (!authorization?.startsWith('Bearer ')) return false;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  if (!anonKey) return false;

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: anonKey },
    signal: AbortSignal.timeout(8_000),
  });
  return authResponse.ok;
}

function plainText(value = '') {
  return String(value)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function moneyRange(record = {}) {
  const floor = plainText(record.awardFloorFormatted || record.awardFloor || '');
  const ceiling = plainText(record.awardCeilingFormatted || record.awardCeiling || '');
  if (floor && ceiling && floor !== ceiling) return `$${floor} – $${ceiling}`;
  if (ceiling) return `Up to $${ceiling}`;
  if (floor) return `From $${floor}`;
  return '';
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

async function fetchGrantDetail(hit) {
  try {
    const detailResponse = await fetch(GRANTS_DETAIL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opportunityId: Number(hit.id) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!detailResponse.ok) throw new Error(`Detail request failed: ${detailResponse.status}`);
    const detailPayload = await detailResponse.json();
    const detail = detailPayload?.data || {};
    const record = detail.synopsis || detail.forecast || {};
    const eligibility = (record.applicantTypes || []).map((item) => item.description).filter(Boolean);
    const instruments = (record.fundingInstruments || []).map((item) => item.description).filter(Boolean);
    const deadline = hit.closeDate || detail.originalDueDateDesc || record.responseDateDesc || '';
    const deadlineDays = daysUntil(deadline);

    return {
      id: String(hit.id),
      source_id: hit.number || detail.opportunityNumber || String(hit.id),
      title: hit.title || detail.opportunityTitle || 'Untitled opportunity',
      type: instruments.some((item) => /cooperative/i.test(item)) ? 'call' : 'grant',
      description: plainText(record.synopsisDesc || record.forecastDesc || ''),
      eligibility: eligibility.join('; '),
      amount: moneyRange(record),
      deadline,
      deadline_days: deadlineDays,
      open_date: hit.openDate || record.postingDate || '',
      status: hit.oppStatus || '',
      agency: hit.agency || hit.agencyName || record.agencyName || detail.agencyDetails?.agencyName || '',
      instruments,
      categories: (record.fundingActivityCategories || []).map((item) => item.description).filter(Boolean),
      source: 'Grants.gov',
      source_url: `https://www.grants.gov/search-results-detail/${hit.id}`,
      is_expiring: deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 60,
      is_new: (() => {
        const opened = daysUntil(hit.openDate);
        return opened !== null && opened <= 0 && opened >= -30;
      })(),
      retrieved_at: new Date().toISOString(),
    };
  } catch {
    const deadlineDays = daysUntil(hit.closeDate);
    return {
      id: String(hit.id),
      source_id: hit.number || String(hit.id),
      title: hit.title || 'Untitled opportunity',
      type: 'grant',
      description: '',
      eligibility: '',
      amount: '',
      deadline: hit.closeDate || '',
      deadline_days: deadlineDays,
      open_date: hit.openDate || '',
      status: hit.oppStatus || '',
      agency: hit.agency || hit.agencyName || '',
      instruments: [],
      categories: [],
      source: 'Grants.gov',
      source_url: `https://www.grants.gov/search-results-detail/${hit.id}`,
      is_expiring: deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 60,
      is_new: false,
      retrieved_at: new Date().toISOString(),
    };
  }
}

function euText(value) {
  if (typeof value === 'string' || typeof value === 'number') return plainText(String(value));
  if (Array.isArray(value)) return value.map(euText).filter(Boolean).join('; ');
  return '';
}

function euCall(item) {
  // SEDIA has changed field casing between portal releases. Keep source facts
  // and links verbatim where possible; unknown fields remain explicitly empty.
  const data = item?.content || item?.metadata || item || {};
  const read = (...keys) => {
    for (const key of keys) {
      const value = data[key] ?? item?.[key];
      const text = euText(value);
      if (text) return text;
    }
    return '';
  };
  const identifier = read('identifier', 'callIdentifier', 'topicIdentifier', 'reference');
  const sourceUrl = read('url', 'webLink', 'callUrl') || (identifier
    ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(identifier)}`
    : 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals');
  return {
    id: `eu:${identifier || read('id') || sourceUrl}`,
    source_id: identifier || read('id'),
    title: read('title', 'callTitle', 'topicTitle') || 'Untitled EU funding opportunity',
    type: 'call',
    description: read('description', 'objective', 'scope'),
    eligibility: read('eligibility', 'eligibleApplicants', 'conditions'),
    amount: read('budget', 'topicBudget', 'maxGrantAmount'),
    deadline: read('deadlineDate', 'deadline', 'submissionDeadline'),
    deadline_days: daysUntil(read('deadlineDate', 'deadline', 'submissionDeadline')),
    status: read('status') || 'Unknown',
    agency: read('programmeName', 'programme', 'frameworkProgramme') || 'European Union',
    country: read('country', 'geographicalZone'),
    categories: [read('keywords', 'subject')].filter(Boolean),
    source: 'EU Funding & Tenders Portal',
    source_url: sourceUrl,
    retrieved_at: new Date().toISOString(),
  };
}

async function searchEuCalls(query, limit) {
  const form = new FormData();
  form.append('query', new Blob([JSON.stringify({
    bool: { must: [{ terms: { type: ['1'] } }, { terms: { status: ['31094501'] } }] },
  })], { type: 'application/json' }), 'query.json');
  const url = `${EU_SEARCH_URL}${encodeURIComponent(query)}&pageSize=${limit}&pageNumber=1&sortBy=relevance`;
  const result = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(12_000) });
  if (!result.ok) throw new Error(`EU Portal request failed: ${result.status}`);
  const payload = await result.json();
  const raw = payload?.results || payload?.data?.results || payload?.items || [];
  return raw.map(euCall).filter((call) => call.title !== 'Untitled EU funding opportunity' || call.source_id).slice(0, limit);
}

export default async function handler(request, response) {
  if (applyCors(request, response, ["GET"])) return;
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    if (!(await authenticate(request.headers.authorization))) {
      return response.status(401).json({ error: 'Authentication required.' });
    }

    const query = String(request.query?.q || '').trim().slice(0, MAX_QUERY_LENGTH);
    if (!query) return response.status(400).json({ error: 'A funding search query is required.' });

    const requestedLimit = Number(request.query?.limit || 12);
    const limit = Math.min(MAX_RESULTS, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 12));

    const providers = await Promise.allSettled([
      fetch(GRANTS_SEARCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rows: limit,
        keyword: query,
        oppStatuses: 'forecasted|posted',
      }),
      signal: AbortSignal.timeout(12_000),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Grants.gov request failed: ${r.status}`);
        const payload = await r.json();
        if (payload?.errorcode !== 0) throw new Error('Grants.gov rejected the search');
        return Promise.all((payload?.data?.oppHits || []).slice(0, limit).map(fetchGrantDetail));
      }),
      searchEuCalls(query, limit),
    ]);
    const items = providers.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const sources = providers.flatMap((result, index) => result.status === 'fulfilled' ? [index === 0 ? 'Grants.gov' : 'EU Funding & Tenders Portal'] : []);
    if (!sources.length) return response.status(502).json({ error: 'Official funding sources are temporarily unavailable.' });
    const failures = providers.filter((result) => result.status === 'rejected').length;

    response.setHeader('Cache-Control', 'private, max-age=300');
    return response.status(200).json({
      query,
      source: sources.join(' + '),
      source_url: 'https://www.grants.gov/search-grants',
      retrieved_at: new Date().toISOString(),
      hit_count: items.length,
      partial_results: failures > 0,
      items,
    });
  } catch (error) {
    console.error('Funding search error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return response.status(500).json({ error: 'Funding search is temporarily unavailable.' });
  }
}
