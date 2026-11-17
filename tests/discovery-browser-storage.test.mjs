import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  discoveryBrowserScope,
  discoveryBrowserListKey,
  readDiscoveryBrowserList,
  writeDiscoveryBrowserList,
  clearDeletedDiscoveryBrowserData,
} from '../src/lib/discovery-browser-storage.mjs';
import { clearDeletedOwnerBrowserData } from '../src/lib/auth/privateBrowserData.mjs';

function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: index => [...map.keys()][index] ?? null,
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  };
}

test('Home saved research is account-isolated and never adopts legacy unscoped searches', () => {
  const stores = {
    local: storage({
      'eylo-public-saved-papers-v1': '[{"title":"Someone else’s paper"}]',
      'eylo-public-search-history-v1': '[{"query":"Private old search"}]',
    }),
    session: storage(),
  };
  const a = discoveryBrowserScope('authenticated', 'account-a');
  const b = discoveryBrowserScope('authenticated', 'account-b');
  assert.deepEqual(readDiscoveryBrowserList(a, 'saved', stores), []);
  assert.deepEqual(readDiscoveryBrowserList(b, 'history', stores), []);
  assert.equal(writeDiscoveryBrowserList(a, 'saved', [{ title: 'Paper for A' }], stores), true);
  assert.equal(writeDiscoveryBrowserList(a, 'history', [{ query: 'Topic for A' }], stores), true);
  assert.equal(writeDiscoveryBrowserList(b, 'saved', [{ title: 'Paper for B' }], stores), true);
  assert.deepEqual(readDiscoveryBrowserList(a, 'saved', stores), [{ title: 'Paper for A' }]);
  assert.deepEqual(readDiscoveryBrowserList(b, 'saved', stores), [{ title: 'Paper for B' }]);
  assert.deepEqual(readDiscoveryBrowserList(b, 'history', stores), []);
  assert.equal(stores.local.getItem('eylo-public-search-history-v1'), '[{"query":"Private old search"}]');
});

test('anonymous discovery is tab-scoped and never shows an authenticated account’s history', () => {
  const stores = { local: storage(), session: storage() };
  const guest = discoveryBrowserScope('anonymous', null);
  const a = discoveryBrowserScope('authenticated', 'owner');
  assert.equal(guest.storage, 'session');
  writeDiscoveryBrowserList(guest, 'history', [{ query: 'Guest question' }], stores);
  writeDiscoveryBrowserList(a, 'history', [{ query: 'Owned question' }], stores);
  assert.deepEqual(readDiscoveryBrowserList(guest, 'history', stores), [{ query: 'Guest question' }]);
  assert.deepEqual(readDiscoveryBrowserList(a, 'history', stores), [{ query: 'Owned question' }]);
  assert.deepEqual(readDiscoveryBrowserList(guest, 'history', { local: stores.local, session: storage() }), []);
  assert.equal(discoveryBrowserScope('loading', 'owner'), null);
  assert.equal(discoveryBrowserScope('idle', ''), null);
  assert.equal(discoveryBrowserScope('error', 'owner'), null);
  assert.equal(discoveryBrowserScope('authenticated', null), null);
  assert.deepEqual(readDiscoveryBrowserList(null, 'history', stores), []);
  assert.equal(writeDiscoveryBrowserList(null, 'saved', [], stores), false);
});

test('owner identifiers cannot interfere with another user’s local browser keys', () => {
  const a = discoveryBrowserScope('authenticated', 'a:b');
  const b = discoveryBrowserScope('authenticated', 'a');
  assert.notEqual(discoveryBrowserListKey(a, 'saved'), discoveryBrowserListKey(b, 'saved'));
  assert.equal(discoveryBrowserListKey(a, 'arbitrary'), '');
  assert.equal(discoveryBrowserListKey({ namespace: 'owner:a:history', storage: 'local' }, 'saved'), '');
});

test('confirmed account deletion clears only that owner’s discovery lists', () => {
  const local = storage();
  const session = storage();
  const a = discoveryBrowserScope('authenticated', 'owner-a');
  const b = discoveryBrowserScope('authenticated', 'owner-b');
  const guest = discoveryBrowserScope('anonymous');
  writeDiscoveryBrowserList(a, 'history', [{ query: 'Private A' }], { local, session });
  writeDiscoveryBrowserList(a, 'saved', [{ title: 'A' }], { local, session });
  writeDiscoveryBrowserList(b, 'saved', [{ title: 'B' }], { local, session });
  writeDiscoveryBrowserList(guest, 'history', [{ query: 'Guest' }], { local, session });
  clearDeletedOwnerBrowserData(local, session, 'owner-a');
  assert.deepEqual(readDiscoveryBrowserList(a, 'saved', { local, session }), []);
  assert.deepEqual(readDiscoveryBrowserList(a, 'history', { local, session }), []);
  assert.deepEqual(readDiscoveryBrowserList(b, 'saved', { local, session }), [{ title: 'B' }]);
  assert.deepEqual(readDiscoveryBrowserList(guest, 'history', { local, session }), [{ query: 'Guest' }]);
  assert.throws(() => clearDeletedDiscoveryBrowserData(local, null), /identity/);
});

test('public /search resolves auth and binds rendered lists to the current scope', () => {
  const page = readFileSync(new URL('../src/pages/PublicDiscovery.jsx', import.meta.url), 'utf8');
  assert.match(page, /if \(authStatus === 'idle'\) void initializeAuth\(\)/);
  assert.match(page, /savedState\.scopeKey === scopeKey \? savedState\.values : \[\]/);
  assert.match(page, /historyState\.scopeKey === scopeKey \? historyState\.values : \[\]/);
  assert.match(page, /readDiscoveryBrowserList\(scope, 'history'/);
  assert.match(page, /writeDiscoveryBrowserList\(scope, 'saved'/);
  assert.doesNotMatch(page, /eylo-public-(?:saved-papers|search-history)-v1/);
});
