const SOURCE_CONFIG = Object.freeze({
  Project: { label: 'Projects', href: item => `/projects/${encodeURIComponent(item.id)}`, fields: ['title', 'description'] },
  Note: { label: 'Notes', href: () => '/notes', fields: ['title', 'content'] },
  LifeTask: { label: 'Tasks and study plan', href: item => item.area === 'study' ? '/study-planner' : '/life', fields: ['title', 'description', 'course', 'syllabus_item'] },
  LifeGoal: { label: 'Goals', href: item => item.area === 'study' ? '/life/goals' : '/life/goals', fields: ['title', 'description'] },
  FlashcardDeck: { label: 'Flashcards', href: () => '/flashcards', fields: ['title', 'description', 'course'] },
  CalendarEvent: { label: 'Calendar', href: () => '/calendar', fields: ['title', 'description', 'project_title'] },
  SavedPaper: { label: 'Saved research', href: () => '/library', fields: ['title', 'abstract', 'authors', 'doi'] },
  Idea: { label: 'Ideas', href: () => '/ideas', fields: ['title', 'description', 'content'] },
});

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

export const UNIVERSAL_SEARCH_SOURCES = Object.freeze(Object.keys(SOURCE_CONFIG));
