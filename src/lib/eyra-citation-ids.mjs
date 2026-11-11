/**
 * A model-generated [P#], [R#], [I#] or [F#] reference must resolve to a
 * retrieved record. A source chip denotes a citation, not a fabricated source.
 * This checks identifier integrity, not whether an abstract supports a claim.
 */
export function checkEyraCitationIds(answer, sources = []) {
  const allowed = new Set((sources || []).map(source => source.id).filter(id => /^(?:P|R|I|F)\d+$/.test(id)));
  const citedIds = [...new Set(String(answer || '').match(/\[(?:P|R|I|F)\d+\]/g) || [])].map(id => id.slice(1, -1));
  const invalidIds = citedIds.filter(id => !allowed.has(id));
  return {
    valid: invalidIds.length === 0,
    invalidIds,
    citedIds,
    citedSources: (sources || []).filter(source => citedIds.includes(source.id)),
  };
}

/** External source navigation never uses javascript:, data:, file: or URL credentials. */
export function isSafeEyraSourceUrl(input) {
  try {
    const url = new URL(String(input || ''));
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.username && !url.password
      && Boolean(url.hostname);
  } catch {
    return false;
  }
}
