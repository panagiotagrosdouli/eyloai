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

export function httpStatusFromError(error) {
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) return error.status;
  const message = error instanceof Error ? error.message : String(error || '');
  const match = message.match(/\b([45]\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function formatUnavailableSource(source) {
  const label = String(source?.label || 'Research source');
  if (source?.error_code === 'DISCOVERY_RATE_LIMIT_UNAVAILABLE') return `${label} could not be reached through EYLO’s research connection`;
  if (source?.error_code === 'DISCOVERY_RATE_LIMITED') return `${label} was not requested because EYLO’s search limit was reached`;
  const status = Number(source?.error_status);
  if (status === 429) return `${label} is rate limited (HTTP 429)`;
  if (status >= 500 && status <= 599) return `${label} is temporarily unavailable (HTTP ${status})`;
  if (status >= 400 && status <= 499) return `${label} returned HTTP ${status}`;
  return `${label} did not respond`;
}
