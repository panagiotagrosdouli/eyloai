export const PAPER_INDEX_SOURCE_IDS = Object.freeze([
  'openalex',
  'arxiv',
  'europe_pmc',
  'crossref',
  'semantic_scholar',
]);

export function countAvailablePaperIndexes(sourceStatuses = []) {
  const availableIds = new Set(
    sourceStatuses
      .filter(source => source.status === 'available')
      .map(source => source.id),
  );
  return PAPER_INDEX_SOURCE_IDS.filter(id => availableIds.has(id)).length;
}
