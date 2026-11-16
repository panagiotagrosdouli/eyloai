import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import handler from '../api/eyra.js';

const keys = [
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
  'EYLO_ENVIRONMENT', 'EYLO_BILLING_TEST_ENABLED',
  'EYLO_STAGING_SUPABASE_REF', 'EYLO_STAGING_CONFIRMED_REF',
  'EYRA_DURABLE_RUNS_ENABLED',
];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const ref = 'abcdefghijklmnopqrst';
const userId = '10000000-0000-4000-8000-000000000001';

function reset() {
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
}
afterEach(reset);

function configure(extra = {}) {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    VITE_SUPABASE_URL: 'https://kbzjngpzxpniaumlupaa.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture',
    OPENAI_API_KEY: 'sk-provider-fixture',
    STRIPE_SECRET_KEY: 'sk_live_credential_presence_only',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
    STRIPE_PRO_PRICE_ID: 'price_pro_fixture',
    STRIPE_FOUNDER_PRICE_ID: 'price_founder_fixture',
    ...extra,
  });
}
function response() {
  return {
    statusCode: 200, payload: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}
function mockedResponses({ reserved = [{ allowed: true, used: 1 }], entitlement = [{ plan: 'founder' }] } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: userId, email: 'fixture@example.test' }), { status: 200 });
    }
    if (url.includes('/rest/v1/billing_entitlements?')) {
      return new Response(JSON.stringify(entitlement), { status: 200 });
    }
    if (url.endsWith('/rest/v1/rpc/reserve_eyra_usage')) {
      return new Response(JSON.stringify(reserved), { status: 200 });
    }
    if (url === 'https://api.openai.com/v1/responses') {
      return new Response(JSON.stringify({
        id: 'resp_fixture', model: 'eyra-test-model', status: 'completed',
        output: [{ content: [{ type: 'output_text', text: 'A grounded short test answer.' }] }],
      }), { status: 200 });
    }
    throw new Error('Unexpected mocked request ' + url);
  };
  return calls;
}
async function invoke() {
  const res = response();
  await handler({
    method: 'POST', headers: { authorization: 'Bearer test-user-access-token' },
    body: { prompt: 'Explain the distinction between a hypothesis and a finding.' },
  }, res);
  return res;
}

test('live Stripe credentials cannot enable paid EYRA quotas in the production project', async () => {
  configure();
  const calls = mockedResponses();
  const res = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.plan, 'free');
  assert.equal(res.payload.usage.limit, 5);
  assert.equal(calls.filter(call => call.url.includes('billing_entitlements')).length, 0);
  const reserve = calls.find(call => call.url.endsWith('/rpc/reserve_eyra_usage'));
  assert.equal(JSON.parse(reserve.init.body).p_limit, 5);
  assert.equal(calls.filter(call => call.url.includes('api.openai.com')).length, 1);
});

test('approved separate staging can read its paid entitlement but cannot use live Stripe credentials', async () => {
  configure({
    EYLO_ENVIRONMENT: 'staging',
    EYLO_BILLING_TEST_ENABLED: '1',
    EYLO_STAGING_SUPABASE_REF: ref,
    EYLO_STAGING_CONFIRMED_REF: ref,
    VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
    STRIPE_SECRET_KEY: 'sk_test_fixture',
  });
  const calls = mockedResponses({ entitlement: [{ plan: 'founder' }] });
  const res = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.plan, 'founder');
  assert.equal(res.payload.usage.limit, null);
  assert.equal(calls.filter(call => call.url.includes('billing_entitlements')).length, 1);
  assert.equal(JSON.parse(calls.find(call => call.url.endsWith('/rpc/reserve_eyra_usage')).init.body).p_limit, null);
});

test('broken or missing quota reservations return 503, never a false plan-limit error or model call', async () => {
  for (const reserved of [[], null, {}, [{ allowed: 'false', used: 5 }], [{ allowed: true, used: -1 }], [{ allowed: true, used: 'not-a-number' }], [{ allowed: true, used: null }]]) {
    configure();
    const calls = mockedResponses({ reserved });
    const res = await invoke();
    assert.equal(res.statusCode, 503, 'Invalid reservation must fail closed');
    assert.equal(res.payload.code, 'USAGE_CONTROLS_UNAVAILABLE');
    assert.equal(calls.some(call => call.url.includes('api.openai.com')), false);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});

test('a valid denied quota reservation retains the authenticated 429 free-plan limit', async () => {
  configure();
  const calls = mockedResponses({ reserved: [{ allowed: false, used: 5 }] });
  const res = await invoke();
  assert.equal(res.statusCode, 429);
  assert.equal(res.payload.code, 'PLAN_LIMIT_REACHED');
  assert.equal(res.payload.usage.used, 5);
  assert.equal(res.payload.usage.limit, 5);
  assert.equal(calls.some(call => call.url.includes('api.openai.com')), false);
});

test('backend quota HTTP failures do not claim free quota exhaustion', async () => {
  configure();
  const calls = mockedResponses();
  const base = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/rpc/reserve_eyra_usage')) {
      calls.push({ url: String(input), init });
      return new Response('{}', { status: 503 });
    }
    return base(input, init);
  };
  const res = await invoke();
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.code, 'USAGE_CONTROLS_UNAVAILABLE');
  assert.equal(calls.some(call => call.url.includes('api.openai.com')), false);
});
