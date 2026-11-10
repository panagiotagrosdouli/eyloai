import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAuthenticatedSignIn } from '../src/lib/auth/sessionContract.js';

test('incomplete and mismatched sign-in payloads cannot authorize navigation', () => {
  assert.equal(hasAuthenticatedSignIn(null), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' } }), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' }, session: { access_token: 'token' } }), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' }, session: { user: { id: 'b' }, access_token: 'token' } }), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' }, session: { user: { id: 'a' }, access_token: 'token' } }), true);
});
