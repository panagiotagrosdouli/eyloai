const MAX_COMPARISON_RECORDS = 3;
const OFFICIAL_HOSTS = ['grants.gov', 'europa.eu'];

function normalizeSelection(selectedIds) {
  return [...new Set(Array.isArray(selectedIds)
    ? selectedIds.filter((id) => typeof id === 'string' && id.length > 0)
    : [])].slice(0, MAX_COMPARISON_RECORDS);
}

export function toggleFundingComparisonSelection(selectedIds, id) {
  if (typeof id !== 'string' || !id) return null;
  const selected = normalizeSelection(selectedIds);
  if (selected.includes(id)) return selected.filter((selectedId) => selectedId !== id);
  if (selected.length >= MAX_COMPARISON_RECORDS) return null;
  return [...selected, id];
}

export function getFundingComparisonRecords(records, selectedIds) {
  const selected = new Set(normalizeSelection(selectedIds));
  return (Array.isArray(records) ? records : []).filter((record) => record && selected.has(record.id));
}

export function filterFundingOpportunities(records, filters = {}) {
  const category = typeof filters.category === 'string' ? filters.category : 'all';
  const deadline = typeof filters.deadline === 'string' ? filters.deadline : 'all';
  const field = typeof filters.field === 'string' ? filters.field.trim().toLocaleLowerCase() : '';
  const country = typeof filters.country === 'string' ? filters.country.trim().toLocaleLowerCase() : '';

  return (Array.isArray(records) ? records : []).filter((record) => {
    if (!record || typeof record !== 'object') return false;
    if (category !== 'all' && record.type !== category) return false;
    const expired = Number.isFinite(record.deadline_days) && record.deadline_days < 0;
    if (deadline === 'expired' && !expired) return false;
    if (deadline === 'active' && expired) return false;

    const searchText = formatFundingComparisonValue([
      record.title,
      record.description,
      record.categories,
      record.instruments,
    ]).toLocaleLowerCase();
    if (field && !searchText.includes(field)) return false;

    const countryText = formatFundingComparisonValue([record.country, record.eligibility]).toLocaleLowerCase();
    if (country && !countryText.includes(country)) return false;
    return true;
  });
}

/** Render provider fields as plain text; React escapes the resulting text. */
export function formatFundingComparisonValue(value) {
  if (value == null || value === '') return 'Not provided by source';
  if (typeof value === 'string') return value.trim() || 'Not provided by source';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const entries = value.map(formatFundingComparisonValue)
      .filter((entry) => entry !== 'Not provided by source');
    return entries.length ? entries.join('; ') : 'Not provided by source';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item != null && item !== '')
      .map(([key, item]) => `${key}: ${formatFundingComparisonValue(item)}`);
    return entries.length ? entries.join('; ') : 'Not provided by source';
  }
  return 'Not provided by source';
}

export function isSafeFundingSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const hostname = url.hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
