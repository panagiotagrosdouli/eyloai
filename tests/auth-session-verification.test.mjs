import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyUserOnce } from '../src/lib/auth/sessionVerification.mjs';

test('simultaneous checks for the same token make only one provider request', async () => {
  let calls = 0;
  let finish;
  const provider = async token => {
    calls++;
    return await new Promise(resolve => { finish = () => resolve({ token }); });
  };
  const first = verifyUserOnce('singleflight-test-1', provider);
  const second = verifyUserOnce('singleflight-test-1', provider);
  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  assert.deepEqual(await first, { token: 'singleflight-test-1' });
  assert.deepEqual(await second, { token: 'singleflight-test-1' });
});

test('verification is not cached after completion', async () => {
  let calls = 0;
  const provider = async () => { calls++; return { ok: true }; };
  await verifyUserOnce('singleflight-test-2', provider);
  await verifyUserOnce('singleflight-test-2', provider);
  assert.equal(calls, 2);
});

test('failed verification can be retried and does not poison subsequent requests', async () => {
  let calls = 0;
  const provider = async () => { if (++calls === 1) throw new Error('network'); return true; };
  await assert.rejects(verifyUserOnce('singleflight-test-3', provider), /network/);
  assert.equal(await verifyUserOnce('singleflight-test-3', provider), true);
  assert.equal(calls, 2);
});

test('different tokens never share a verification request', async () => {
  let calls = 0;
  const provider = async () => ++calls;
  const results = await Promise.all([
    verifyUserOnce('singleflight-test-4a', provider),
    verifyUserOnce('singleflight-test-4b', provider),
  ]);
  assert.deepEqual(results, [1, 2]);
});
