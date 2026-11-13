const SOURCE_CONFIG = Object.freeze({
  Project: { label: 'Projects', href: item => `/projects/${encodeURIComponent(item.id)}`, fields: ['title', 'description'] },
  Note: { label: 'Notes', href: item => `/notes?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'content'] },
  LifeTask: { label: 'Tasks and study plan', href: item => `/life?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'description', 'course', 'syllabus_item'] },
  LifeGoal: { label: 'Goals', href: item => `/life/goals?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'description'] },
  FlashcardDeck: { label: 'Flashcards', href: item => `/flashcards?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'description', 'course'] },
  CalendarEvent: { label: 'Calendar', href: item => `/calendar?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'description', 'project_title'] },
  SavedPaper: { label: 'Saved research', href: item => `/library?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'abstract', 'authors', 'doi'] },
  Idea: { label: 'Ideas', href: item => `/ideas?focus=${encodeURIComponent(item.id)}`, fields: ['title', 'description', 'content'] },
  EyloFile: { label: 'EYLO Files', href: item => `/files?focus=${encodeURIComponent(item.id)}`, fields: ['name', 'description'] },
});

export const UNIVERSAL_SEARCH_PAGE_SIZE = 20;
export const UNIVERSAL_SEARCH_SOURCES = Object.freeze(Object.keys(SOURCE_CONFIG));

/** Validate and normalize the bounded, per-source server search response. */
export function normalizeSearchPage(payload, source) {
  if (!SOURCE_CONFIG[source] || !payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw Object.assign(new Error('The search service returned an invalid response.'), { code: 'SEARCH_RESPONSE_INVALID' });
  }
  const total = Number(payload.total);
  const page = Number(payload.page);
  const pageSize = Number(payload.page_size);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50 || payload.items.length > pageSize) {
    throw Object.assign(new Error('The search service returned invalid pagination metadata.'), { code: 'SEARCH_RESPONSE_INVALID' });
  }
  const items = payload.items.map((row) => {
    if (!row || typeof row.id !== 'string' || !row.id || typeof row.title !== 'string') {
      throw Object.assign(new Error('The search service returned an invalid record.'), { code: 'SEARCH_RESPONSE_INVALID' });
    }
    return {
      id: `${source}:${row.id}`, recordId: row.id, source,
      sourceLabel: SOURCE_CONFIG[source].label,
      title: row.title.slice(0, 240),
      snippet: typeof row.snippet === 'string' ? row.snippet.slice(0, 500) : '',
      updatedDate: typeof row.updated_date === 'string' ? row.updated_date : null,
      score: Number.isFinite(Number(row.score)) ? Number(row.score) : null,
      href: SOURCE_CONFIG[source].href({ id: row.id, area: row.area }),
    };
  });
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function searchSourcePage({ rpc, source, query, page = 1, pageSize = UNIVERSAL_SEARCH_PAGE_SIZE, signal }) {
  if (!UNIVERSAL_SEARCH_SOURCES.includes(source)) {
    throw Object.assign(new Error('This search source is not supported.'), { code: 'SEARCH_SOURCE_INVALID' });
  }
  const term = String(query || '').trim();
  if (term.length < 2 || term.length > 200) {
    throw Object.assign(new Error('Search must be between 2 and 200 characters.'), { code: 'SEARCH_QUERY_INVALID' });
  }
  const requestedPage = Math.max(1, Math.min(10000, Math.floor(Number(page) || 1)));
  const requestedSize = Math.max(1, Math.min(50, Math.floor(Number(pageSize) || UNIVERSAL_SEARCH_PAGE_SIZE)));
  const rpcName = source === 'EyloFile' ? 'search_private_files' : 'search_workspace_records';
  const args = source === 'EyloFile' ? {
    p_query: term,
    p_page: requestedPage,
    p_page_size: requestedSize,
  } : {
    p_source: source,
    p_query: term,
    p_page: requestedPage,
    p_page_size: requestedSize,
  };
  const { data, error } = await rpc(rpcName, args, signal);
  if (error) throw Object.assign(new Error(error.message || 'Workspace search failed.'), { code: error.code || 'SEARCH_FAILED' });
  return normalizeSearchPage(data, source);
}

function valuesFor(item, fields) {
  return fields.flatMap(field => {
    const value = item?.[field];
    if (Array.isArray(value)) return value.map(entry => typeof entry === 'string' ? entry : entry?.name || '').filter(Boolean);
    return typeof value === 'string' || typeof value === 'number' ? [String(value)] : [];
  });
}

export function searchWorkspaceRecords(collections, query, sourceFilter = 'all') {
  const term = String(query || '').trim().toLocaleLowerCase();
  if (term.length < 2) return [];
  const results = [];
  for (const [source, records] of Object.entries(collections || {})) {
    const config = SOURCE_CONFIG[source];
    if (!config || (sourceFilter !== 'all' && sourceFilter !== source)) continue;
    for (const item of Array.isArray(records) ? records : []) {
      const values = valuesFor(item, config.fields);
      const haystack = values.join(' ').toLocaleLowerCase();
      if (!haystack.includes(term)) continue;
      const title = String(item.title || item.name || 'Untitled record');
      const exact = title.toLocaleLowerCase() === term;
      const titleMatch = title.toLocaleLowerCase().includes(term);
      const matchingText = values.find(value => value.toLocaleLowerCase().includes(term)) || '';
      const matchIndex = matchingText.toLocaleLowerCase().indexOf(term);
      const snippet = matchingText ? matchingText.slice(Math.max(0, matchIndex - 60), Math.min(matchingText.length, matchIndex + term.length + 120)).trim() : '';
      results.push({ id: `${source}:${item.id}`, recordId: item.id, source, sourceLabel: config.label, title, href: config.href(item), snippet, score: (exact ? 4 : 0) + (titleMatch ? 2 : 0) });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function paginateSearchResults(results, page = 1, pageSize = 20) {
  const size = Math.max(1, Math.min(100, Math.floor(Number(pageSize) || 20)));
  const total = results.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.max(1, Math.min(pages, Math.floor(Number(page) || 1)));
  const start = (currentPage - 1) * size;
  return { items: results.slice(start, start + size), total, page: currentPage, pageSize: size, pages };
}


