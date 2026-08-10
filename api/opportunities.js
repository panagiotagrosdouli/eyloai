const DEFAULT_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const GRANTS_SEARCH_URL = 'https://api.grants.gov/v1/api/search2';
const GRANTS_DETAIL_URL = 'https://api.grants.gov/v1/api/fetchOpportunity';
const MAX_QUERY_LENGTH = 240;
const MAX_RESULTS = 15;

async function authenticate(authorization) {
  if (!authorization?.startsWith('Bearer ')) return false;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  if (!anonKey) return false;

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: anonKey },
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

export default async function handler(request, response) {
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

    const searchResponse = await fetch(GRANTS_SEARCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rows: limit,
        keyword: query,
        oppStatuses: 'forecasted|posted',
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!searchResponse.ok) {
      return response.status(502).json({ error: 'The official funding source is temporarily unavailable.' });
    }

    const searchPayload = await searchResponse.json();
    if (searchPayload?.errorcode !== 0) {
      return response.status(502).json({ error: 'The official funding source rejected the search.' });
    }

    const hits = searchPayload?.data?.oppHits || [];
    const items = await Promise.all(hits.slice(0, limit).map(fetchGrantDetail));

    response.setHeader('Cache-Control', 'private, max-age=300');
    return response.status(200).json({
      query,
      source: 'Grants.gov',
      source_url: 'https://www.grants.gov/search-grants',
      retrieved_at: new Date().toISOString(),
      hit_count: Number(searchPayload?.data?.hitCount || items.length),
      items,
    });
  } catch (error) {
    console.error('Funding search error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return response.status(500).json({ error: 'Funding search is temporarily unavailable.' });
  }
}
