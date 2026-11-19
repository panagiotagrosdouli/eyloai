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

/**
 * External research links must be public HTTP(S) URLs, not local-network or
 * credential-bearing destinations supplied by untrusted provider metadata.
 * This is a navigation boundary, not a substitute for backend SSRF controls.
 */
export function isSafeEyraSourceUrl(input) {
  try {
    const url = new URL(String(input || ''));
    if (!['https:', 'http:'].includes(url.protocol)
      || url.username || url.password || !url.hostname) return false;

    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost')
      || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.invalid')
      || host === '0' || host === '::1' || host === '::'
      || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')
      || host.startsWith('::ffff:')) return false;

    if (/^\d+(?:\.\d+){3}$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 198 && (b === 18 || b === 19))) return false;
    }
    return true;
  } catch {
    return false;
  }
}
