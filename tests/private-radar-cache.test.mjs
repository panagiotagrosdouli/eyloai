import test from 'node:test';
import assert from 'node:assert/strict';
import { RADAR_CACHE_KEYS, RADAR_OWNER_KEY, bindRadarBrowserCache, clearRadarBrowserCache } from '../src/lib/auth/privateRadarCache.mjs';

function fakeStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test('same account preserves its Radar workspace cache', () => {
  const storage = fakeStorage();
  bindRadarBrowserCache(storage, 'researcher-a');
  storage.setItem(RADAR_CACHE_KEYS[0], '[{"private":"a"}]');
  bindRadarBrowserCache(storage, 'researcher-a');
  assert.equal(storage.getItem(RADAR_CACHE_KEYS[0]), '[{"private":"a"}]');
});

test('switching accounts invalidates all Radar caches before new session can render them', () => {
  const storage = fakeStorage();
  bindRadarBrowserCache(storage, 'researcher-a');
  for (const key of RADAR_CACHE_KEYS) storage.setItem(key, 'PRIVATE-A');
  bindRadarBrowserCache(storage, 'researcher-b');
  for (const key of RADAR_CACHE_KEYS) assert.equal(storage.getItem(key), null);
  assert.equal(storage.getItem(RADAR_OWNER_KEY), 'researcher-b');
});

test('legacy unowned cache and logout cannot leak watchlists to next user', () => {
  const storage = fakeStorage();
  storage.setItem(RADAR_CACHE_KEYS[1], 'LEGACY_PRIVATE');
  bindRadarBrowserCache(storage, 'researcher-a');
  assert.equal(storage.getItem(RADAR_CACHE_KEYS[1]), null);
  storage.setItem(RADAR_CACHE_KEYS[2], 'PRIVATE-A');
  clearRadarBrowserCache(storage);
  assert.equal(storage.getItem(RADAR_CACHE_KEYS[2]), null);
  assert.equal(storage.getItem(RADAR_OWNER_KEY), null);
});
