import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/stripe-webhook.js';

const previousSecretKey = process.env.STRIPE_SECRET_KEY;
const previousTestMode = process.env.EYLO_STRIPE_TEST_MODE;
process.env.STRIPE_SECRET_KEY = 'sk_test_disposable';
process.env.EYLO_STRIPE_TEST_MODE = '1';
after(() => {
  if (previousSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousSecretKey;
  if (previousTestMode === undefined) delete process.env.EYLO_STRIPE_TEST_MODE;
  else process.env.EYLO_STRIPE_TEST_MODE = previousTestMode;
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

test('Stripe webhook refuses processing without explicit test-mode configuration', async () => {
  const previousSecretKey = process.env.STRIPE_SECRET_KEY;
  const previousTestMode = process.env.EYLO_STRIPE_TEST_MODE;
  process.env.STRIPE_SECRET_KEY = 'sk_live_disposable';
  process.env.EYLO_STRIPE_TEST_MODE = '1';
  try {
    const res = response();
    await handler(request(Buffer.from('{"id":"evt_live","type":"ping"}')), res);
    assert.equal(res.code, 503);
    assert.deepEqual(res.payload, { error: 'Stripe test-mode processing is not enabled.' });
  } finally {
    if (previousSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecretKey;
    if (previousTestMode === undefined) delete process.env.EYLO_STRIPE_TEST_MODE;
    else process.env.EYLO_STRIPE_TEST_MODE = previousTestMode;
  }
});

test('Stripe webhook still rejects untrusted signatures on ordinary payloads', async () => {
  const res = response();
  await handler(request(Buffer.from('{"id":"evt_test","type":"ping"}')), res);
  assert.equal(res.code, 400);
  assert.deepEqual(res.payload, { error: 'Invalid Stripe signature.' });
});

test('Stripe webhook accepts valid signed small events without database updates', async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'test-only-secret';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    const payload = JSON.stringify({ id: 'evt_test', type: 'ping', data: { object: {} } });
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
  const secret = 'disposable-signature-test-secret';
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
  const secret = 'disposable-signature-test-secret';
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
