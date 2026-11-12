export function buildResearchGapCoverage(result = {}) {
  const sources = (Array.isArray(result.source_status) ? result.source_status : [])
    .filter((source) => source && typeof source.id === 'string')
    .map((source) => ({
      id: source.id,
      label: typeof source.label === 'string' && source.label ? source.label : source.id,
      status: source.status === 'available' ? 'available' : 'unavailable',
      count: source.status === 'available' && Number.isFinite(source.count) ? Math.max(0, Math.floor(source.count)) : 0,
    }));
  return {
    record_count: Array.isArray(result.papers) ? result.papers.length : 0,
    available_source_count: sources.filter((source) => source.status === 'available').length,
    unavailable_source_count: sources.filter((source) => source.status === 'unavailable').length,
    sources,
  };
}
