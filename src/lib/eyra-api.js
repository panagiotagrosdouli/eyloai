// EYRA Discovery Engine — Real Data Sources
// OpenAlex, arXiv, Crossref, Europe PMC

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'mailto=eylo@research.app';
const SOURCE_TIMEOUT_MS = 12_000;

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
    const res = await fetchWithTimeout(
      `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&per_page=${limit}&sort=${sortValue}&${MAILTO}`
    );
    if (!res.ok) throw new Error(`OpenAlex request failed: ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(w => ({
      id: w.id,
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
    const res = await fetchWithTimeout(
      `${OPENALEX_BASE}/authors?search=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance_score:desc&${MAILTO}`
    );
    if (!res.ok) throw new Error(`OpenAlex author request failed: ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(a => ({
      id: a.id,
      name: a.display_name,
      institution: a.last_known_institutions?.[0]?.display_name || 'Independent',
      country: a.last_known_institutions?.[0]?.country_code || '',
      research_areas: (a.x_concepts || []).slice(0, 4).map(c => c.display_name).join(', '),
      works_count: a.works_count || 0,
      citation_count: a.cited_by_count || 0,
      profile_url: `https://openalex.org/authors/${a.id?.split('/').pop()}`,
      openalex_id: a.id,
      // h-index proxy: not in API but we show works/citations
    }));
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchOpenAlexInstitutions(query, limit = 6, strictOptions = {}) {
  try {
    const res = await fetchWithTimeout(
      `${OPENALEX_BASE}/institutions?search=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance_score:desc&${MAILTO}`
    );
    if (!res.ok) throw new Error(`OpenAlex institution request failed: ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(i => ({
      id: i.id,
      name: i.display_name,
      type: i.type || 'institution',
      country: i.country_code || '',
      works_count: i.works_count || 0,
      cited_by_count: i.cited_by_count || 0,
      url: i.homepage_url || `https://openalex.org/institutions/${i.id?.split('/').pop()}`,
    }));
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchArxiv(query, limit = 5, sort = 'relevance', strictOptions = {}) {
  try {
    const sortBy = sort === 'recent' ? 'submittedDate' : 'relevance';
    const res = await fetchWithTimeout(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=${sortBy}&sortOrder=descending`
    );
    if (!res.ok) throw new Error(`arXiv request failed: ${res.status}`);
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const entries = xml.querySelectorAll('entry');
    return Array.from(entries).map(e => {
      const published = e.querySelector('published')?.textContent || '';
      const year = new Date(published).getFullYear();
      return {
        id: e.querySelector('id')?.textContent || '',
        title: (e.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim(),
        authors: Array.from(e.querySelectorAll('author name')).slice(0, 4).map(n => n.textContent).join(', '),
        summary: (e.querySelector('summary')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
        year,
        url: e.querySelector('id')?.textContent || '',
        source: 'arXiv',
        cited_by_count: 0,
        open_access: true,
        _score: Math.max(0, 10 - (new Date().getFullYear() - year) * 0.5), // recency only for arXiv
      };
    });
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchEuropePMC(query, limit = 5, strictOptions = {}) {
  try {
    const res = await fetchWithTimeout(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${limit}&sort=RELEVANCE`
    );
    if (!res.ok) throw new Error(`Europe PMC request failed: ${res.status}`);
    const data = await res.json();
    return (data.resultList?.result || []).map(r => {
      const year = parseInt(r.pubYear) || null;
      const citedBy = parseInt(r.citedByCount) || 0;
      return {
        id: r.id || r.pmid || '',
        title: r.title || 'Untitled',
        authors: r.authorString || '',
        summary: (r.abstractText || '').slice(0, 400),
        year,
        url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
        source: 'Europe PMC',
        cited_by_count: citedBy,
        open_access: r.isOpenAccess === 'Y',
        _score: Math.min(Math.log10(citedBy + 1) * 10, 40) + Math.max(0, 10 - (new Date().getFullYear() - (year || 2000)) * 0.5),
      };
    });
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchCrossref(query, limit = 5, sort = 'relevance', strictOptions = {}) {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(limit),
      select: 'DOI,title,author,abstract,published,container-title,is-referenced-by-count,URL',
      mailto: 'eylo@research.app',
    });
    if (sort === 'recent') {
      params.set('sort', 'published');
      params.set('order', 'desc');
    }
    const res = await fetchWithTimeout(`https://api.crossref.org/works?${params}`);
    if (!res.ok) throw new Error(`Crossref request failed: ${res.status}`);
    const data = await res.json();

    return (data.message?.items || []).map((work) => {
      const dateParts = work.published?.['date-parts']?.[0] || [];
      const year = Number(dateParts[0]) || null;
      const authors = (work.author || []).slice(0, 4).map((author) =>
        [author.given, author.family].filter(Boolean).join(' ')
      ).filter(Boolean).join(', ');
      const citedBy = Number(work['is-referenced-by-count']) || 0;
      const abstract = (work.abstract || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      return {
        id: work.DOI || work.URL,
        doi: work.DOI || '',
        title: work.title?.[0] || 'Untitled',
        authors,
        summary: abstract.slice(0, 400),
        year,
        url: work.DOI ? `https://doi.org/${work.DOI}` : work.URL,
        source: work['container-title']?.[0] || 'Crossref',
        cited_by_count: citedBy,
        open_access: false,
        _score: Math.min(Math.log10(citedBy + 1) * 10, 40)
          + Math.max(0, 10 - (new Date().getFullYear() - (year || 2000)) * 0.5),
      };
    });
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

export async function searchSemanticScholar(query, limit = 8, strictOptions = {}) {
  try {
    const fields = [
      'paperId', 'title', 'authors', 'year', 'abstract', 'url', 'venue',
      'citationCount', 'openAccessPdf', 'externalIds', 'publicationDate',
    ].join(',');
    const params = new URLSearchParams({ query, limit: String(limit), fields });
    const response = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`);
    if (!response.ok) throw new Error(`Semantic Scholar request failed: ${response.status}`);
    const data = await response.json();
    return (data.data || []).map(paper => {
      const doi = paper.externalIds?.DOI || '';
      return {
        id: paper.paperId,
        doi,
        title: paper.title || 'Untitled',
        authors: (paper.authors || []).slice(0, 4).map(author => author.name).filter(Boolean).join(', '),
        summary: (paper.abstract || '').slice(0, 400),
        year: paper.year || (paper.publicationDate ? new Date(paper.publicationDate).getFullYear() : null),
        url: doi ? `https://doi.org/${doi}` : paper.openAccessPdf?.url || paper.url,
        source: paper.venue || 'Semantic Scholar',
        source_index: 'Semantic Scholar',
        cited_by_count: paper.citationCount || 0,
        open_access: Boolean(paper.openAccessPdf?.url),
      };
    });
  } catch (error) {
    return emptyOrThrow(error, strictOptions);
  }
}

function normalizedTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 100);
}

function queryCoverage(paper, query) {
  const terms = [...new Set(normalizedTitle(query).split(' ').filter(term => term.length > 2))];
  if (!terms.length) return 0.5;
  const searchable = `${paper.title || ''} ${paper.summary || ''}`.toLowerCase();
  const matches = terms.filter(term => {
    const root = term.length > 5 ? term.slice(0, -2) : term;
    return searchable.includes(term) || searchable.includes(root);
  }).length;
  return matches / terms.length;
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
  return queryCoverage(paper, profile.query) * 55
    + providerRelevance * 30
    + sourceRank * 20
    + ageScore * recencyWeight
    + citations * citationWeight
    + surveyBoost
    + (paper.open_access ? 4 : 0);
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

// Retrieve broadly, preserve source health, deduplicate, then rank for the user's level and goal.
export async function searchAllPapersWithStatus(query, options = {}) {
  const profile = typeof options === 'number'
    ? { limit: options }
    : options;
  const normalizedProfile = {
    query,
    level: profile.level || 'researcher',
    goal: profile.goal || 'review',
    recency: profile.recency || 'balanced',
    limit: Math.min(30, Math.max(8, Number(profile.limit) || 20)),
  };
  const sort = ['latest', 'five_years'].includes(normalizedProfile.recency) ? 'recent' : 'relevance';
  const definitions = [
    { id: 'openalex', label: 'OpenAlex', load: () => searchOpenAlexWorks(query, 12, sort, { throwOnError: true }) },
    { id: 'arxiv', label: 'arXiv', load: () => searchArxiv(query, 8, sort, { throwOnError: true }) },
    { id: 'europe_pmc', label: 'Europe PMC', load: () => searchEuropePMC(query, 8, { throwOnError: true }) },
    { id: 'crossref', label: 'Crossref', load: () => searchCrossref(query, 8, sort, { throwOnError: true }) },
    { id: 'semantic_scholar', label: 'Semantic Scholar', load: () => searchSemanticScholar(query, 10, { throwOnError: true }) },
  ];

  const settled = await Promise.allSettled(definitions.map(source => source.load()));
  const sourceStatus = settled.map((result, sourceIndex) => ({
    id: definitions[sourceIndex].id,
    label: definitions[sourceIndex].label,
    status: result.status === 'fulfilled' ? 'available' : 'unavailable',
    count: result.status === 'fulfilled' ? result.value.length : 0,
  }));
  const sources = settled.map((result, sourceIndex) => result.status === 'fulfilled'
    ? result.value.map((item, itemIndex) => ({
        ...item,
        source_index: definitions[sourceIndex].label,
        _source_rank: itemIndex,
      }))
    : []);

  const seen = new Set();
  const all = sources.flat().filter(paper => {
    const key = paper.doi ? `doi:${String(paper.doi).toLowerCase()}` : `title:${normalizedTitle(paper.title)}`;
    if (!paper.title || seen.has(key)) return false;
    seen.add(key);
    paper._dedupeKey = key;
    return true;
  });

  const ranked = all.map((paper, index) => ({
    ...paper,
    discovery_score: Math.round(discoveryScore(paper, index, normalizedProfile)),
    discovery_category: categorizePaper(paper, normalizedProfile),
  })).sort((a, b) => b.discovery_score - a.discovery_score);

  const selected = diversifyPapers(ranked, normalizedProfile.limit);
  const startCandidates = selected
    .filter(paper => paper.discovery_category === 'start_here')
    .concat(selected.filter(paper => paper.discovery_category !== 'start_here'))
    .slice(0, 3);
  const startIds = new Set(startCandidates.map(paper => paper._dedupeKey));
  const papers = selected.map(paper => ({
    ...paper,
    discovery_category: startIds.has(paper._dedupeKey) ? 'start_here' : paper.discovery_category,
  }));

  return {
    papers,
    source_status: sourceStatus,
    available_source_count: sourceStatus.filter(source => source.status === 'available').length,
    unavailable_source_count: sourceStatus.filter(source => source.status === 'unavailable').length,
  };
}

export async function searchAllPapers(query, options = {}) {
  const result = await searchAllPapersWithStatus(query, options);
  return result.papers;
}
