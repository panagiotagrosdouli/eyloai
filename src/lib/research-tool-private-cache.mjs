/**
 * A browser-session cache may contain private research. Never use a shared
 * non-owner-scoped key or restore a record with a different owner identity.
 */
export function privateResearchCacheKey(kind, ownerId) {
  if (!/^[a-z][a-z0-9-]{1,50}$/.test(String(kind)) || typeof ownerId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(ownerId)) {
    throw new TypeError('Authenticated owner and valid cache kind required');
  }
  return 'eylo-private-v1:' + kind + ':' + ownerId;
}

export function readPrivateResearchCache(storage, kind, ownerId, date = new Date().toDateString()) {
  const key = privateResearchCacheKey(kind, ownerId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value?.ownerId === ownerId && value.date === date && typeof value.savedAt === 'string'
      && value.analysis && typeof value.analysis === 'object' && !Array.isArray(value.analysis) ? value : null;
  } catch { return null; }
}

export function writePrivateResearchCache(storage, kind, ownerId, analysis, when = new Date()) {
  const key = privateResearchCacheKey(kind, ownerId);
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) throw new TypeError('Analysis object required');
  const entry = { ownerId, date: when.toDateString(), savedAt: when.toISOString(), analysis };
  try {
    storage.setItem(key, JSON.stringify(entry));
    return true;
  } catch { return false; }
}
