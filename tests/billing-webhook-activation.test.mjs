import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { afterEach, test } from 'node:test';
import handler from '../api/stripe-webhook.js';

const PROJECT_REF = 'abcdefghijklmnopqrst';
const originalFetch = globalThis.fetch;
const keys = [
  'EYLO_ENVIRONMENT', 'EYLO_BILLING_TEST_ENABLED',
  'EYLO_STAGING_SUPABASE_REF', 'EYLO_STAGING_CONFIRMED_REF',
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));

function configureStaging() {
  const env = {
    EYLO_ENVIRONMENT: 'staging',
    EYLO_BILLING_TEST_ENABLED: '1',
    EYLO_STAGING_SUPABASE_REF: PROJECT_REF,
    EYLO_STAGING_CONFIRMED_REF: PROJECT_REF,
    VITE_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key',
    SUPABASE_SECRET_KEY: 'fixture-server-key',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
    STRIPE_PRO_PRICE_ID: 'price_fixturepro',
    STRIPE_FOUNDER_PRICE_ID: 'price_fixturefounder',
  };
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function response() {
  return {
    statusCode: 200, body: null,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}
function subscriptionEvent(livemode = false) {
  return {
    id: 'evt_fixture_123',
    type: 'customer.subscription.updated',
    created: 1794840000,
    livemode,
    data: {
      object: {
        id: 'sub_fixture_123',
        customer: 'cus_fixture_123',
        status: 'active',
        current_period_end: 1797000000,
        metadata: { plan: 'pro', user_id: '00000000-0000-4000-8000-000000000001' },
      },
    },
  };
}
function signedRequest(event, { secret = 'whsec_fixture', overrideSignature, payload } = {}) {
  const body = payload ?? JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const request = Readable.from([body]);
  request.method = 'POST';
  request.headers = { 'stripe-signature': overrideSignature ?? `t=${timestamp},v1=${signature}` };
  return request;
}

test('webhook refuses production even with a correctly signed Stripe event and does not read the body', async () => {
  configureStaging();
  process.env.EYLO_ENVIRONMENT = 'production';
  let bodyRead = false;
  let fetched = false;
  globalThis.fetch = () => { fetched = true; throw new Error('Unexpected fetch'); };
  const request = {
    method: 'POST', headers: {},
    async *[Symbol.asyncIterator]() { bodyRead = true; yield '{}'; },
  };
  const result = response();
  await handler(request, result);
  assert.equal(result.statusCode, 503);
  assert.equal(bodyRead, false);
  assert.equal(fetched, false);
});

test('webhook refuses known production Supabase ref even if labeled staging', async () => {
  configureStaging();
  process.env.VITE_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
  process.env.EYLO_STAGING_SUPABASE_REF = 'kbzjngpzxpniaumlupaa';
  process.env.EYLO_STAGING_CONFIRMED_REF = 'kbzjngpzxpniaumlupaa';
  globalThis.fetch = () => { throw new Error('Unexpected external request'); };
  const result = response();
  await handler(signedRequest(subscriptionEvent()), result);
  assert.equal(result.statusCode, 503);
});

test('webhook rejects a signed live-mode event before database access', async () => {
  configureStaging();
  let networkCalls = 0;
  globalThis.fetch = () => { networkCalls += 1; throw new Error('Unexpected fetch'); };
  const result = response();
  await handler(signedRequest(subscriptionEvent(true)), result);
  assert.equal(result.statusCode, 400);
  assert.equal(networkCalls, 0);
});

test('webhook refuses events lacking a boolean false livemode marker', async () => {
  configureStaging();
  globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
  const event = subscriptionEvent();
  delete event.livemode;
  const result = response();
  await handler(signedRequest(event), result);
  assert.equal(result.statusCode, 400);
});

test('invalid webhook signatures remain rejected in approved test staging', async () => {
  configureStaging();
  globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
  const result = response();
  await handler(signedRequest(subscriptionEvent(), { overrideSignature: 't=123,v1=deadbeef' }), result);
  assert.equal(result.statusCode, 400);
});

test('only verified test-mode events reach the server-owned entitlement RPC', async () => {
  configureStaging();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, json: async () => ({}) };
  };
  const result = response();
  await handler(signedRequest(subscriptionEvent(false)), result);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { received: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/apply_billing_entitlement`);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.p_plan, 'pro');
  assert.equal(body.p_event_id, 'evt_fixture_123');
  assert.equal(body.p_user_id, '00000000-0000-4000-8000-000000000001');
  assert.equal(body.p_subscription_status, 'active');
});
