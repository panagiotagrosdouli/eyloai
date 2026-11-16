import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/stripe-webhook.js';

const stagingRef = 'abcdefghijklmnopqrst';
const testKeys = [
  'EYLO_ENVIRONMENT', 'EYLO_BILLING_TEST_ENABLED', 'EYLO_STAGING_SUPABASE_REF',
  'EYLO_STAGING_CONFIRMED_REF', 'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
];
const originalEnvironment = Object.fromEntries(testKeys.map(key => [key, process.env[key]]));
beforeEach(() => {
  Object.assign(process.env, {
    EYLO_ENVIRONMENT: 'staging', EYLO_BILLING_TEST_ENABLED: '1',
    EYLO_STAGING_SUPABASE_REF: stagingRef, EYLO_STAGING_CONFIRMED_REF: stagingRef,
    VITE_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
    SUPABASE_PUBLISHABLE_KEY: 'test-public', SUPABASE_SECRET_KEY: 'test-server',
    STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
    STRIPE_PRO_PRICE_ID: 'price_fixturepro', STRIPE_FOUNDER_PRICE_ID: 'price_fixturefounder',
  });
});
afterEach(() => {
  for (const key of testKeys) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

function request(body, signature = 't=1,v1=invalid') {
  return {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    async *[Symbol.asyncIterator]() {
      yield body;
    },
  };
}

function response() {
  return {
    code: null,
    payload: null,
    status(code) { this.code = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('Stripe webhook rejects oversized raw payloads before signature processing', async () => {
  const res = response();
  await handler(request(Buffer.alloc(1024 * 1024 + 1, 'a')), res);
  assert.equal(res.code, 413);
  assert.deepEqual(res.payload, { error: 'Webhook payload too large.' });
});

test('Stripe webhook still rejects untrusted signatures on ordinary payloads', async () => {
  const res = response();
  await handler(request(Buffer.from('{"id":"evt_test","type":"ping"}')), res);
  assert.equal(res.code, 400);
  assert.deepEqual(res.payload, { error: 'Invalid Stripe signature.' });
});

test('Stripe webhook accepts valid signed small events without database updates', async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_test_only_secret';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    const payload = JSON.stringify({ id: 'evt_test', type: 'ping', livemode: false, data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const res = response();
    await handler(request(Buffer.from(payload), `t=${timestamp},v1=${signature}`), res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.payload, { received: true });
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});

test('a correctly signed but malformed JSON event fails with 400, not a retryable 500', async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_disposable_signature_test_secret';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    const payload = '{not valid json';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const res = response();
    await handler(request(Buffer.from(payload), `t=${timestamp},v1=${signature}`), res);
    assert.equal(res.code, 400);
    assert.deepEqual(res.payload, { error: 'Invalid Stripe event JSON.' });
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});

test('malformed Stripe signature header types fail authentication cleanly', async () => {
  const res = response();
  await handler(request(Buffer.from('{}'), ['t=1', 'v1=invalid']), res);
  assert.equal(res.code, 400);
  assert.deepEqual(res.payload, { error: 'Invalid Stripe signature.' });
});

test('signed array or null events are rejected before entitlement processing', async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_disposable_signature_test_secret';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    for (const payload of ['[]', 'null']) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
      const res = response();
      await handler(request(Buffer.from(payload), `t=${timestamp},v1=${signature}`), res);
      assert.equal(res.code, 400);
      assert.deepEqual(res.payload, { error: 'Invalid Stripe event.' });
    }
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});
