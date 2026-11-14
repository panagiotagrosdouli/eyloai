export const GRAPH_COLLECTION_LIMIT = 250;
const SOURCES = [
  ['papers', 'SavedPaper', '-created_date'],
  ['researchers', 'SavedResearcher', '-created_date'],
  ['projects', 'Project', '-updated_date'],
  ['notes', 'Note', '-updated_date'],
  ['tasks', 'LifeTask', '-updated_date'],
];

/** Read-only canonical collections. The repository validates the expected owner
 * against Auth and the raw PostgreSQL user_id before flattening JSONB records. */
export async function loadResearchGraphCollections({ entities, ownerId }) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) throw new Error('Sign in to load your research graph.');
  const results = await Promise.allSettled(SOURCES.map(async ([, entity, sort]) => {
    const rows = await entities[entity].list(sort, GRAPH_COLLECTION_LIMIT + 1, ownerId);
    if (!Array.isArray(rows)) throw new Error('Invalid collection response.');
    return rows;
  }));
  const collections = {}, unavailable = [], truncated = [];
  results.forEach((result, index) => {
    const name = SOURCES[index][0];
    if (result.status === 'rejected') { collections[name] = []; unavailable.push(name); return; }
    if (result.value.length > GRAPH_COLLECTION_LIMIT) truncated.push(name);
    collections[name] = result.value.slice(0, GRAPH_COLLECTION_LIMIT);
  });
  return { collections, unavailable, truncated, allUnavailable: unavailable.length === SOURCES.length };
}
