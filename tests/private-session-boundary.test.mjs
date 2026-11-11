import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldClearPrivateCache } from '../src/lib/auth/privateSessionBoundary.js';

test('private cache is invalidated when a new user replaces the old user', () => {
  assert.equal(shouldClearPrivateCache('researcher-a', 'researcher-b', 'SIGNED_IN'), true);
  assert.equal(shouldClearPrivateCache('researcher-a', 'researcher-a', 'TOKEN_REFRESHED'), false);
  assert.equal(shouldClearPrivateCache(null, 'researcher-a', 'SIGNED_IN'), false);
});

test('logout and authentication revocation always clear private cache', () => {
  assert.equal(shouldClearPrivateCache(null, null, 'SIGNED_OUT'), true);
  assert.equal(shouldClearPrivateCache('researcher-a', null, 'SIGNED_OUT'), true);
  assert.equal(shouldClearPrivateCache('researcher-a', null, 'AUTH_REQUIRED'), true);
});
