Warning: truncated output (original token count: 7396)
Total output lines: 658

// EYRA Discovery Engine — Real Data Sources
// OpenAlex, arXiv, Crossref, Europe PMC

import { httpStatusFromError } from './discovery-source-status.js';

const OPENALEX_BASE = 'https://api.openalex.org';
const RESEARCH_CONTACT_EMAIL = String(import.meta.env?.VITE_RESEARCH_CONTACT_EMAIL || '').trim();
const OPENALEX_CONTACT = RESEARCH_CONTACT_EMAIL ? `&mailto=${encodeURIComponent(RESEARCH_CONTACT_EMAIL)}` : '';
// Keep the browser-side deadline longer than the discovery proxy's 15s
// upstream deadline so it can return the provider's HTTP status (for example
// a proxy 504) instead of turning a slow source into a network error.
const SOURCE_TIMEOUT_MS = 18_000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function emptyOrThrow(error, options = {}) {
  if (options.throwOnError) throw error;
  return [];
}

function proxyUrl(provider, query, limit, sort = 'relevance', page = 1, country = '', baseUrl = '') {
  const params = new URLSearchParams({
    provider,
    q: query,
    limit: String(limit),
    sort,
  });
  if (provider === 'openalex_authors') {
    params.set('page', String(page));
    if (country) params.set('country', country);
  }
  const path = `/api/discovery?${params}`;
  return baseUrl ? new URL(path, baseUrl).toString() : path;
}

async function fetchResearchSource(provider, query, limit, sort, directUrl, options = {}) {
  const configuredProxyBase = String(options.proxyBaseUrl || '').trim();
  const proxyBaseUrl = configuredProxyBase ? new URL(configuredProxyBase).origin : '';
  const shouldUseProxy = Boolean(proxyBaseUrl) || (typeof window !== 'undefined' && !import.meta.env?.DEV);

  if (shouldUseProxy) {
    try {
      const proxied = await fetchWithTimeout(proxyUrl(
        provider,
        query,
        limit,
        sort,
        options.page || 1,
        options.country || '',
        proxyBaseUrl,
      ), options);
      // An explicitly configured proxy is the benchmark target. Do not make a
      // failed deployment proxy look healthy by silently querying providers directly.
      if (proxyBaseUrl) return proxied;
      if (proxied.ok || proxied.status < 500) return proxied;
    } catch (error) {
      if (proxyBaseUrl) throw error;
      // Fall back to the provider directly when the same-origin proxy itself is unavailable.
    }
  }

  return fetchWithTimeout(directUrl, options);
}

function reconstructAbstract(inverted) {
  if (!inverted) return '';
  const words = [];
  Object.entries(inverted).forEach(([word, positions]) => {
    positions.forEach(pos => { words[pos] = word; });
  });
  return words.filter(Boolean).join(' ');
}

// Relevance + recency + citation composite score
function scoreWork(w) {
  const now = new Date().getFullYear();
  const age = now - (w.publication_year || 2000);
  const recencyScore = Math.max(0, 10 - age * 0.5); // newer = higher
  const citationScore = Math.min(Math.log10((w.cited_by_count || 0) + 1) * 10, 40);
  const relevanceScore = (w.relevance_score || 0.5) * 50;
  return recencyScore + citationScore + relevanceScore;
}

export async function searchOpenAlexWorks(query, limit = 10, sort = 'relevance', strictOptions = {}) {
  try {
    const sortValue = sort === 'recent' ? 'publication_date:desc' : 'relevance_score:desc';
    const directUrl = `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&per_page=${limit}&sort=${sortValue}${OPENALEX_CONTACT}`;
    const res = await fetchResearchSource('openalex_works', query, limit, sort, directUrl, strictOptions);
    if (!res.ok) throw new Error(`OpenAlex request failed: ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(w => ({
      id: w.id,
      doi: w.doi ? w.doi.replace('https://doi.org/', '') : '',
      title: w.title || 'Untitled',
      authors: (w.authorships || []).slice(0, 4).map(a => a.author?.display_name).filter(Boolean).join(', '),
      year: w.publication_year,
      summary: w.abstract_inverted_index
        ? reconstructAbstract(w.abstract_inverted_index).slice(0, 400)
        : '',
      url: w.doi ? `https://doi.org/${w.doi.replace('https://doi.org/', '')}` : w.id,
      source: w.primary_location?.source?.display_name || 'OpenAlex',
      cited_by_count: w.cited_by_count || 0,
      open_access: !!w.open_access?.is_oa,
      type: w.type || 'article',
      relevance_score: w.relevance_score || 0,
      _score: scoreWork(w),
    }));
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchOpenAlexAuthors(query, limit = 8, strictOptions = {}) {
  try {
    const page = Math.min(200, Math.max(1, Number(strictOptions.page) || 1));
    const country = /^[A-Z]{2}$/.test(String(strictOptions.country || '').toUpperCase()) ? String(strictOptions.country).toUpperCase() : '';
    const countryFilter = country ? `&filter=last_known_institutions.country_code:${country}` : '';
    const directUrl = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(query)}&per_page=${limit}&page=${page}&sort=relevance_score:desc${countryFilter}${OPENALEX_CONTACT}`;
    const res = await fetchResearchSource('openalex_authors', query, limit, 'relevance', directUrl, { ...strictOptions, page, country });
    if (!res.ok) throw new Error(`OpenAlex author request failed: ${res.status}`);
    const data = await res.json();
    const authors = (data.results || []).map(a => ({
      id: a.id,
      name: a.display_name,
      // An absent OpenAlex affiliation is unknown, not proof of independence.
      institution: a.last_known_institutions?.[0]?.display_name || 'Affiliation not available',
      affiliation_verified: Boolean(a.last_known_institutions?.[0]?.display_name),
      // OpenAlex does not establish academic rank or PhD enrolment.
      academic_role: null,
      academic_role_verified: false,
      profile_photo_url: null,
      photo_status: 'unavailable',
      data_source: 'OpenAlex',
      country: a.last_known_institutions?.[0]?.country_code || '',
      // Current OpenAlex records provide publication-derived topics; x_concepts is legacy.
      research_areas: (a.topics?.length ? a.topics.map(t => t.display_name || t.subfield?.display_name).filter(Boolean) : (a.x_concepts || []).map(c => c.display_name)).slice(0, 5).join(', '),
      research_topics_source: a.topics?.length ? 'OpenAlex publication topics' : 'OpenAlex legacy concepts',
      works_count: a.works_count || 0,
      citation_count: a.cited_by_count || 0,
      profile_url: `https://openalex.org/authors/${a.id?.split('/').pop()}`,
      openalex_id: a.id,
      // h-index proxy: not in API but we show works/citations
    }));
    // OpenAlex's author search may return no rows for multiword research topics
    // even when its works index has matching papers. Recover real people from
    // those papers' authorship records instead of returning an empty list.
    if (!authors.length) return searchResearchPeopleByPublications(query, limit, strictOptions);
    return authors;
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

// Find named people from real scholarly authorships when an OpenAlex author-name
// search does not surface candidates for a subject such as "PhD in robotics".
// Publication authorship is not proof of professor rank or supervisor availability.
export async function searchResearchPeopleByPublications(query, limit = 25, strictOptions = {}) {
  try {
    const topic = String(query || '').replace(/\\bph\\.?d\\.?\\b|\\bdoctorate\\b|\\bdoctoral\\b|\\bin\\b/gi, ' ').trim() || String(query || '').trim();
    const page = Math.min(200, Math.max(1, Number(strictOptions.page) || 1));
    const directUrl = `${OPENALEX_BASE}/works?search=${encodeURIComponent(topic)}&per_page=25&page=${page}&sort=relevance_score:desc${OPENALEX_CONTACT}`;
    // Page one can use EYLO's proxy. Other pages are fetched directly until
    // the works proxy supports a page argument.
    const response = page === 1
      ? await fetchResearchSource('openalex_works', topic, 25, 'relevance', directUrl, strictOptions)
      : await fetchWithTimeout(directUrl);
    if (!response.ok) throw new Error(`OpenAlex publication search failed: ${response.status}`);
    const payload = await response.json();
    const people = new Map();
    for (const work of payload.results || []) {
      for (const authorship of work.authorships || []) {
        const author = authorship.author || {};
        const id = String(author.id || '');
        if (!/^https:\/\/openalex\.org\/A\d+$/.test(id) || !author.display_name) continue;
        const institution = authorship.institutions?.[0];
        const country = institution?.country_code || '';
        if (strictOptions.country && country !== strictOptions.country) continue;
        if (people.has(id)) continue;
        people.set(id, {
          id, openalex_id: id, name: author.display_name,
          institution: institution?.display_name || 'Affiliation not available',
          affiliation_verified: Boolean(institution?.display_name),
          academic_role: null, academic_role_verified: false,
          profile_photo_url: null, photo_status: 'unavailable',
          data_source: 'OpenAlex publication authorship',
          country, research_areas: topic,
          research_topics_source: 'Matched publication search query (not a verified author specialty)',
          works_count: null, citation_count: null,
          profile_url: `https://openalex.org/authors/${id.split('/').pop()}`,
        });
        if (people.size >= limit) break;
      }
      if (people.size >= limit) break;
    }
    return [...people.values()];
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchOpenAlexInstitutions(query, li…2396 tokens truncated…&& term.length > 4) return term.slice(0, -1);
  return term;
}

function queryTerms(query) {
  return [...new Set(
    normalizedTitle(query).split(' ')
      .filter(term => (term.length > 2 || term === 'ai') && !QUERY_STOP_WORDS.has(term))
  )];
}

const TERM_SYNONYMS = {
  ageing: ['aging', 'older adult', 'elderly'],
  trustworthy: ['trust', 'responsib', 'ethic', 'fair', 'explain'],
  uncertainty: ['probabili', 'stochastic', 'confidence'],
  vulnerable: ['pedestrian', 'cyclist'],
};

function termMatches(searchable, term) {
  if (term === 'ai') {
    return /\bai\b/i.test(searchable) || searchable.includes('artificial intelligence');
  }
  const alternatives = TERM_SYNONYMS[term] || [];
  return searchable.includes(term)
    || searchable.includes(queryRoot(term))
    || alternatives.some(alternative => searchable.includes(alternative));
}

function queryCoverage(paper, query) {
  const terms = queryTerms(query);
  if (!terms.length) return 0.5;
  const searchable = normalizeSearchText(`${paper.title || ''} ${paper.summary || ''}`);
  const matches = terms.filter(term => termMatches(searchable, term)).length;
  return matches / terms.length;
}

function matchesLeadConcept(paper, query) {
  const [leadTerm] = queryTerms(query);
  if (!leadTerm) return true;
  const searchable = normalizeSearchText(`${paper.title || ''} ${paper.summary || ''}`);
  return termMatches(searchable, leadTerm);
}

function negatesLeadConcept(paper, query) {
  const [leadTerm] = queryTerms(query);
  if (!leadTerm) return false;
  const searchable = normalizeSearchText(`${paper.title || ''} ${paper.summary || ''}`);
  const root = queryRoot(leadTerm);
  return [`without ${leadTerm}`, `without ${root}`, `non-${leadTerm}`, `non ${leadTerm}`]
    .some(pattern => searchable.includes(pattern));
}

function discoveryScore(paper, index, profile) {
  const year = Number(paper.year) || 0;
  const age = year ? Math.max(0, new Date().getFullYear() - year) : 30;
  const citations = Math.log10((Number(paper.cited_by_count) || 0) + 1);
  const title = String(paper.title || '').toLowerCase();
  const isSurvey = /(survey|review|overview|systematic|tutorial|state of the art|primer)/i.test(title);
  const recencyWeight = profile.recency === 'latest' ? 38 : profile.recency === 'five_years' ? 27 : profile.recency === 'foundational' ? 4 : 18;
  const citationWeight = profile.recency === 'foundational' ? 22 : profile.level === 'beginner' ? 13 : 9;
  const surveyBoost = ['beginner', 'student'].includes(profile.level) || profile.goal === 'understand' ? (isSurvey ? 24 : 0) : (isSurvey ? 6 : 0);
  const ageScore = Math.max(0, 12 - age) / 12;
  const sourceRank = Math.max(0, 1 - (Number(paper._source_rank ?? index) / 12));
  const providerRelevance = Math.min(1, Math.max(0, Number(paper.relevance_score) || 0));
  const coverage = queryCoverage(paper, profile.query);
  const lowCoveragePenalty = coverage < 0.34 ? 55 : 0;
  const adjustedCitationWeight = profile.recency === 'foundational' ? citationWeight : Math.min(citationWeight, 6);
  return coverage * 150
    + providerRelevance * 12
    + sourceRank * 16
    + ageScore * recencyWeight
    + citations * adjustedCitationWeight
    + surveyBoost
    + (paper.open_access ? 4 : 0)
    - lowCoveragePenalty;
}

function categorizePaper(paper, profile) {
  const year = Number(paper.year) || 0;
  const age = year ? new Date().getFullYear() - year : 99;
  const title = String(paper.title || '');
  const survey = /(survey|review|overview|systematic|tutorial|state of the art|primer)/i.test(title);
  if (survey && (['beginner', 'student'].includes(profile.level) || profile.goal === 'understand')) return 'start_here';
  if (age <= 2) return 'latest';
  if ((paper.cited_by_count || 0) >= 100 || survey) return 'foundational';
  return 'relevant';
}

function diversifyPapers(papers, limit) {
  const selected = [];
  const selectedIds = new Set();
  const byIndex = new Map();
  papers.forEach(paper => {
    const index = paper.source_index || paper.source || 'Other';
    if (!byIndex.has(index)) byIndex.set(index, []);
    byIndex.get(index).push(paper);
  });

  // Guarantee breadth before filling by score.
  for (let round = 0; round < 2; round += 1) {
    for (const group of byIndex.values()) {
      const paper = group[round];
      if (paper && selected.length < limit && !selectedIds.has(paper._dedupeKey)) {
        selected.push(paper);
        selectedIds.add(paper._dedupeKey);
      }
    }
  }
  papers.forEach(paper => {
    if (selected.length < limit && !selectedIds.has(paper._dedupeKey)) {
      selected.push(paper);
      selectedIds.add(paper._dedupeKey);
    }
  });
  return selected.sort((a, b) => b.discovery_score - a.discovery_score);
}

function normalizeRankingProfile(query, options = {}) {
  const profile = typeof options === 'number' ? { limit: options } : options;
  return {
    query,
    level: profile.level || 'researcher',
    goal: profile.goal || 'review',
    recency: profile.recency || 'balanced',
    limit: Math.min(30, Math.max(1, Number(profile.limit) || 20)),
  };
}

export function rankPaperRecords(records, query, options = {}) {
  const profile = normalizeRankingProfile(query, options);
  const seen = new Set();
  const currentYear = new Date().getFullYear();
  const uniqueRecords = (records || []).flat().filter(Boolean)
    .filter(isScholarlyWorkRecord)
    // Provider metadata can contain malformed or future publication years.
    // Keep undated records visible, but never present an invalid future year as established research.
    .filter(paper => {
      if (paper.year == null || paper.year === '') return true;
      const year = Number(paper.year);
      return Number.isInteger(year) && year >= 1500 && year <= currentYear;
    })
    .filter(paper => {
      if (!['latest', 'five_years'].includes(profile.recency) || !paper.year) return true;
      const earliestYear = currentYear - (profile.recency === 'latest' ? 2 : 5);
      return Number(paper.year) >= earliestYear;
    }).map(paper => {
    const doi = normalizedDoi(paper.doi || paper.url);
    const key = doi
      ? `doi:${doi}`
      : `title:${normalizedTitle(paper.title)}`;
    return { ...paper, _dedupeKey: key };
  }).filter(paper => {
    if (!paper.title || seen.has(paper._dedupeKey)) return false;
    seen.add(paper._dedupeKey);
    return true;
  });

  const queryTermCount = queryTerms(profile.query).length;
  const minimumCoverage = queryTermCount > 0 && queryTermCount <= 4 ? 1 : 0.67;
  const ranked = uniqueRecords.map((paper, index) => ({
    ...paper,
    query_coverage: Number(queryCoverage(paper, profile.query).toFixed(2)),
    lead_query_match: matchesLeadConcept(paper, profile.query),
    lead_query_negated: negatesLeadConcept(paper, profile.query),
    discovery_score: Math.round(discoveryScore(paper, index, profile)),
    discovery_category: categorizePaper(paper, profile),
  }))
    .filter(paper => paper.query_coverage >= minimumCoverage && paper.lead_query_match && !paper.lead_query_negated)
    .sort((a, b) => b.discovery_score - a.discovery_score);

  const selected = diversifyPapers(ranked, profile.limit);
  const startCandidates = selected
    .filter(paper => paper.discovery_category === 'start_here')
    .concat(selected.filter(paper => paper.discovery_category !== 'start_here'))
    .slice(0, 3);
  const startIds = new Set(startCandidates.map(paper => paper._dedupeKey));

  return selected.map(paper => ({
    ...paper,
    discovery_category: startIds.has(paper._dedupeKey) ? 'start_here' : paper.discovery_category,
  }));
}

// Retrieve broadly, preserve source health, deduplicate, then rank for the user's level and goal.
export async function searchAllPapersWithStatus(query, options = {}) {
  const normalizedProfile = normalizeRankingProfile(query, options);
  const proxyBaseUrl = options && typeof options === 'object' && 'proxyBaseUrl' in options
    ? options.proxyBaseUrl
    : '';
  const sourceRequestOptions = {
    throwOnError: true,
    ...(typeof proxyBaseUrl === 'string' && proxyBaseUrl
      ? { proxyBaseUrl }
      : {}),
  };
  const sort = ['latest', 'five_years'].includes(normalizedProfile.recency) ? 'recent' : 'relevance';
  const definitions = [
    { id: 'openalex', label: 'OpenAlex', load: () => searchOpenAlexWorks(query, 12, sort, sourceRequestOptions) },
    { id: 'arxiv', label: 'arXiv', load: () => searchArxiv(query, 8, sort, sourceRequestOptions) },
    { id: 'europe_pmc', label: 'Europe PMC', load: () => searchEuropePMC(query, 8, sourceRequestOptions) },
    { id: 'crossref', label: 'Crossref', load: () => searchCrossref(query, 8, sort, sourceRequestOptions) },
    { id: 'semantic_scholar', label: 'Semantic Scholar', load: () => searchSemanticScholar(query, 10, sourceRequestOptions) },
  ];

  const settled = await Promise.allSettled(definitions.map(source => source.load()));
  const sourceStatus = settled.map((result, sourceIndex) => ({
    id: definitions[sourceIndex].id,
    label: definitions[sourceIndex].label,
    status: result.status === 'fulfilled' ? 'available' : 'unavailable',
    count: result.status === 'fulfilled' ? result.value.length : 0,
    error_status: result.status === 'rejected' ? httpStatusFromError(result.reason) : null,
  }));
  const sources = settled.map((result, sourceIndex) => result.status === 'fulfilled'
    ? result.value.map((item, itemIndex) => ({
        ...item,
        source_index: definitions[sourceIndex].label,
        _source_rank: itemIndex,
      }))
    : []);

  return {
    papers: rankPaperRecords(sources.flat(), query, normalizedProfile),
    source_status: sourceStatus,
    available_source_count: sourceStatus.filter(source => source.status === 'available').length,
    unavailable_source_count: sourceStatus.filter(source => source.status === 'unavailable').length,
  };
}

export async function searchAllPapers(query, options = {}) {
  const result = await searchAllPapersWithStatus(query, options);
  return result.papers;
}
