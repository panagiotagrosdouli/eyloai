// Validate EYRA's proposed scholarly search strategy. Only OpenAlex results
// identify people: the AI may suggest search topics, never researcher records.
export function normalizeResearcherSearchPlan(response, original) {
  const text = String(original || '').trim().slice(0, 500);
  const raw = Array.isArray(response?.search_queries) ? response.search_queries : [];
  const searches = [...new Set(raw
    .filter(value => typeof value === 'string')
    .map(value => value.trim().slice(0, 120))
    .filter(value => value.length >= 3 && !/[\r\n]/.test(value)))].slice(0, 3);
  return {
    searches: searches.length ? searches : [text],
    explanation: String(response?.interpretation || '').trim().slice(0, 350),
    generated: searches.length > 0,
  };
}
