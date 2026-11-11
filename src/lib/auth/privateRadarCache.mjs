// Research Radar's browser cache is private to one authenticated account.
// Legacy unowned caches are intentionally discarded on first signed-in use.
export const RADAR_CACHE_KEYS = Object.freeze([
  'eylo_watchlists_v1',
  'eylo_monitoring_discoveries_v1',
  'eylo_notifications_v1',
]);
export const RADAR_OWNER_KEY = 'eylo_radar_cache_owner_v1';

export function clearRadarBrowserCache(storage) {
  for (const key of RADAR_CACHE_KEYS) storage.removeItem(key);
  storage.removeItem(RADAR_OWNER_KEY);
}

export function bindRadarBrowserCache(storage, userId) {
  if (!userId) {
    clearRadarBrowserCache(storage);
    return;
  }
  if (storage.getItem(RADAR_OWNER_KEY) !== userId) {
    for (const key of RADAR_CACHE_KEYS) storage.removeItem(key);
  }
  storage.setItem(RADAR_OWNER_KEY, userId);
}

export function isRadarCacheOwner(storage, expectedUserId) {
  return Boolean(expectedUserId && storage.getItem(RADAR_OWNER_KEY) === expectedUserId);
}
