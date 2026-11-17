import test from 'node:test';
import assert from 'node:assert/strict';
import { withAuthRequestDeadline, AUTH_REQUEST_TIMEOUT_MS } from '../src/lib/auth/authRequestDeadline.mjs';

test('Auth requests settle normally and preserve provider results', async () => {
  const result = await withAuthRequestDeadline(() => Promise.resolve({ data: { user: { id: 'fixture' } }, error: null }), 100);
  assert.equal(result.data.user.id, 'fixture');
  assert.equal(AUTH_REQUEST_TIMEOUT_MS, 15000);
});

test('an unresolved auth request cannot keep the UI loading forever', async () => {
  const unsettled = new Promise(() => {});
  await assert.rejects(
    withAuthRequestDeadline(() => unsettled, 10),
    error => error.code === 'AUTH_REQUEST_TIMEOUT' && error.name === 'AuthRequestTimeoutError',
  );
});

test('a late provider resolution does not turn the timed-out request into a success result', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  await assert.rejects(withAuthRequestDeadline(() => pending, 10), { code: 'AUTH_REQUEST_TIMEOUT' });
  complete({ session: { access_token: 'fixture-only' } });
});

test('auth timeouts reject invalid callers and durations', async () => {
  await assert.rejects(withAuthRequestDeadline(null), /callable/);
  await assert.rejects(withAuthRequestDeadline(() => Promise.resolve(), 0), /Invalid auth timeout/);
});
