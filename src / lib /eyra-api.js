// EYRA Discovery Engine — Real Data Sources
// OpenAlex, arXiv, Crossref, Europe PMC

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'mailto=eylo@research.app';

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

export async function searchOpenAlexWorks(query, limit = 10) {
  try {
    const res = await fetch(
      `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance_score:desc&${MAILTO}`
    );
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
  } catch {
    return [];
  }
}

export async function searchOpenAlexAuthors(query, limit = 8) {
  try {
    const res = await fetch(
      `${OPENALEX_BASE}/authors?search=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance_score:desc&${MAILTO}`
    );
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
  } catch {
    return [];
  }
}

export async function searchOpenAlexInstitutions(query, limit = 6) {
  try {
    const res = await fetch(
      `${OPENALEX_BASE}/institutions?search=${encodeURIComponent(query)}&per_page=${limit}&sort=relevance_score:desc&${MAILTO}`
    );
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
  } catch {
    return [];
  }
}

export async function searchArxiv(query, limit = 5) {
  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance`
    );
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
  } catch {
    return [];
  }
}

export async function searchEuropePMC(query, limit = 5) {
  try {
    const res = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${limit}&sort=RELEVANCE`
    );
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
  } catch {
    return [];
  }
}

// Combine all sources, deduplicate, rank by composite score
export async function searchAllPapers(query) {
  const [openalex, arxiv, europepmc] = await Promise.all([
    searchOpenAlexWorks(query, 8),
    searchArxiv(query, 5),
    searchEuropePMC(query, 5),
  ]);

  const seen = new Set();
  const all = [...openalex, ...arxiv, ...europepmc].filter(p => {
    const key = p.title.toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by composite score (relevance + recency + citations)
  all.sort((a, b) => (b._score || 0) - (a._score || 0));
  return all.slice(0, 15);
}
