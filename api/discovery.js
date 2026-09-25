const PROVIDERS = new Set([
  'openalex_works',
  'openalex_authors',
  'openalex_institutions',
  'arxiv',
  'europe_pmc',
  'crossref',
  'semantic_scholar',
]);

const MAX_QUERY_LENGTH = 500;
const MAX_LIMIT = 30;
const UPSTREAM_TIMEOUT_MS = 10_000;

function boundedLimit(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function contactEmail() {
  return String(
    process.env.RESEARCH_CONTACT_EMAIL
    || process.env.VITE_RESEARCH_CONTACT_EMAIL
    || '',
  ).trim();
}

function buildProviderUrl(provider, query, limit, sort) {
  const email = contactEmail();

  if (provider === 'openalex_works') {
    const params = new URLSearchParams({
      search: query,
      per_page: String(limit),
      sort: sort === 'recent' ? 'publication_date:desc' : 'relevance_score:desc',
    });
    if (email) params.set('mailto', email);
    return `https://api.openalex.org/works?${params}`;
  }

  if (provider === 'openalex_authors') {
    const params = new URLSearchParams({
      search: query,
      per_page: String(limit),
      sort: 'relevance_score:desc',
    });
    if (email) params.set('mailto', email);
    return `https://api.openalex.org/authors?${params}`;
  }

  if (provider === 'openalex_institutions') {
    const params = new URLSearchParams({
      search: query,
      per_page: String(limit),
      sort: 'relevance_score:desc',
    });
    if (email) params.set('mailto', email);
    return `https://api.openalex.org/institutions?${params}`;
  }

  if (provider === 'arxiv') {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: '0',
      max_results: String(limit),
      sortBy: sort === 'recent' ? 'submittedDate' : 'relevance',
      sortOrder: 'descending',
    });
    return `https://export.arxiv.org/api/query?${params}`;
  }

  if (provider === 'europe_pmc') {
    const params = new URLSearchParams({
      query,
      format: 'json',
      pageSize: String(limit),
      sort: 'RELEVANCE',
    });
    return `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`;
  }

  if (provider === 'crossref') {
    const params = new URLSearchParams({
      query,
      rows: String(limit),
      select: 'DOI,title,author,abstract,published,published-online,published-print,container-title,type,publisher,volume,issue,page,is-referenced-by-count,URL',
    });
    if (email) params.set('mailto', email);
    if (sort === 'recent') {
      params.set('sort', 'published');
      params.set('order', 'desc');
    }
    return `https://api.crossref.org/works?${params}`;
  }

  if (provider === 'semantic_scholar') {
    const fields = [
      'paperId', 'title', 'authors', 'year', 'abstract', 'url', 'venue',
      'citationCount', 'openAccessPdf', 'externalIds', 'publicationDate', 'publicationTypes',
    ].join(',');
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      fields,
    });
    return `https://api.semanticscholar.org/graph/v1/paper/search?${params}`;
  }

  return null;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const provider = String(request.query?.provider || '');
  const query = String(request.query?.q || '').trim();
  const sort = String(request.query?.sort || 'relevance');
  const limit = boundedLimit(request.query?.limit, 10);

  if (!PROVIDERS.has(provider)) {
    return response.status(400).json({ error: 'Unknown discovery provider.' });
  }
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return response.status(400).json({ error: 'Provide a valid research query.' });
  }

  const url = buildProviderUrl(provider, query, limit, sort);
  if (!url) return response.status(400).json({ error: 'Provider configuration is invalid.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: provider === 'arxiv' ? 'application/atom+xml, application/xml;q=0.9, */*;q=0.8' : 'application/json, */*;q=0.8',
        'user-agent': 'EYLO scholarly discovery proxy',
      },
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    response.status(upstream.status);
    response.setHeader('Content-Type', upstream.headers.get('content-type') || (provider === 'arxiv' ? 'application/atom+xml; charset=utf-8' : 'application/json; charset=utf-8'));
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    response.setHeader('X-EYLO-Source', provider);
    return response.send(body);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return response.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Scholarly source timed out.' : 'Scholarly source is temporarily unavailable.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
