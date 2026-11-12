const MAX_COMPARISON_RECORDS = 3;

export function toggleFundingComparisonSelection(selectedIds, id) {
  if (typeof id !== 'string' || !id) return null;
  const selected = Array.isArray(selectedIds) ? selectedIds : [];
  if (selected.includes(id)) return selected.filter((selectedId) => selectedId !== id);
  if (selected.length >= MAX_COMPARISON_RECORDS) return null;
  return [...selected, id];
}

export function getFundingComparisonRecords(records, selectedIds) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds.slice(0, MAX_COMPARISON_RECORDS) : []);
  return (Array.isArray(records) ? records : []).filter((record) => selected.has(record.id));
}
