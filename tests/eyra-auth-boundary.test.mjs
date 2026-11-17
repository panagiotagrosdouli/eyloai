import test from 'node:test';
import assert from 'node:assert/strict';
import { billingActive, serverHeaders, authenticate } from '../server/eyra-auth-boundary.mjs';

test('secret-key authentication headers never use browser-facing bearer credentials', () => {
  const secret = serverHeaders('sb_secret_fake');
  assert.equal(secret.apikey, 'sb_secret_fake');
  assert.equal(secret.authorization, undefined);
  const legacy = serverHeaders('synthetic-service-key');
  assert.equal(legacy.authorization, 'Bearer synthetic-service-key');
});

test('missing user bearer fails before any network request', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected'); };
  try {
    assert.equal(await authenticate(undefined), null);
    assert.equal(await authenticate('Basic hello'), null);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('billing controls do not claim active without every required entitlement secret', () => {
  const keys = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(billingActive(), false);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
