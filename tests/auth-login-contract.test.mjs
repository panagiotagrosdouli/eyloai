import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAuthenticatedSignIn } from '../src/lib/auth/sessionContract.js';

test('password sign-in requires matching user identity and access token', () => {
  assert.equal(hasAuthenticatedSignIn(null), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' } }), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' }, session: { access_token: 'token' } }), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' }, session: { access_token: 'token', user: { id: 'b' } } }), false);
  assert.equal(hasAuthenticatedSignIn({ user: { id: 'a' }, session: { access_token: 'token', user: { id: 'a' } } }), true);
});
