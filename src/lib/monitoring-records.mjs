// Build stable, collision-safe identities for provider records. Provider batches
// can overlap or repeat the same record in a single watchlist check.
function discoveryKey(item) {
  if (!item || typeof item !== 'object') return null;
  const source = typeof item.source === 'string' ? item.source.trim() : '';
  const externalId = typeof item.externalId === 'string' || typeof item.externalId === 'number'
    ? String(item.externalId).trim() : '';
  return source && externalId ? JSON.stringify([source, externalId]) : null;
}

export function selectNewMonitoringDiscoveries(candidates, existing = []) {
  const known = new Set((Array.isArray(existing) ? existing : []).map(discoveryKey).filter(Boolean));
  return (Array.isArray(candidates) ? candidates : []).filter(item => {
    const key = discoveryKey(item);
    if (!key || known.has(key)) return false;
    known.add(key);
    return true;
  });
}

// Treat a provider's URL as untrusted input, including entries already saved
// before the validation was added. Use the normalized absolute HTTPS URL only.
export function safeMonitoringSourceUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}
