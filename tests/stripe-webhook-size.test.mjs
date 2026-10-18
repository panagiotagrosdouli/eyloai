import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/stripe-webhook.js';

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
