import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visibleOwnerProfileState } from '../src/lib/auth/owner-scoped-profile.mjs';

const ownerA = '00000000-0000-4000-8000-000000000001';
const ownerB = '00000000-0000-4000-8000-000000000002';
const previous = {
  ownerId: ownerA,
  data: { activeProjects: [{ id: 'private-project', title: 'Owner A private research' }],
    user: { full_name: 'Owner A' }, papers: [{ title: 'Private source' }] },
  loaded: true,
  error: false,
};

test('cached records from owner A never render under owner B or signed-out state', () => {
  for (const identity of [ownerB, null, '', undefined]) {
    assert.deepEqual(visibleOwnerProfileState(previous, identity), {
      data: null, loaded: false, error: false,
    });
  }
  assert.deepEqual(visibleOwnerProfileState(previous, ownerA).data, previous.data);
});

test('a late successful result for a previously signed-in owner is never visible', () => {
  const staleResult = { ...previous, loaded: true };
  const visible = visibleOwnerProfileState(staleResult, ownerB);
  assert.equal(visible.data, null);
  assert.equal(visible.loaded, false);
  assert.equal(visible.error, false);
});

test('owner-scoped loading, success and failure remain distinguishable', () => {
  const pending = visibleOwnerProfileState({ ownerId: ownerB, data: null, loaded: false, error: false }, ownerB);
  const failure = visibleOwnerProfileState({ ownerId: ownerB, data: null, loaded: true, error: true }, ownerB);
  assert.deepEqual(pending, { data: null, loaded: false, error: false });
  assert.deepEqual(failure, { data: null, loaded: true, error: true });
});

test('Home refreshes on owner change and prevents stale asynchronous results', () => {
  const ui = readFileSync(new URL('../src/components/dashboard/EyraHome.jsx', import.meta.url), 'utf8');
  assert.match(ui, /const ownerId = authUser\?\.id \?\? null;/);
  assert.match(ui, /\[loadAttempt, ownerId\]/);
  assert.match(ui, /if \(active\) setProfileState/);
  assert.match(ui, /return \(\) => \{ active = false; \};/);
  assert.match(ui, /visibleOwnerProfileState\(profileState, ownerId\)/);
  assert.doesNotMatch(ui, /setProfile\(next\)/);
});
