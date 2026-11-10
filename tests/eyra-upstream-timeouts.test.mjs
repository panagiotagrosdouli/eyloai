import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import handler from '../api/eyra.js';

const previousFetch = globalThis.fetch;
const previousOpenAIKey = process.env.OPENAI_API_KEY;
const previousSupabaseUrl = process.env.VITE_SUPABASE_URL;
const previousPublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_disposable_test';
const previousServerKeys = {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
  STRIPE_FOUNDER_PRICE_ID: process.env.STRIPE_FOUNDER_PRICE_ID,
};
after(() => {
  globalThis.fetch = previousFetch;
  if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenAIKey;
  if (previousSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = previousSupabaseUrl;
  if (previousPublishableKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY = previousPublishableKey;
  for (const [key, value] of Object.entries(previousServerKeys)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function apiResponse() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
test('EYRA bounds both Supabase authentication and model requests', async () => {
  process.env.OPENAI_API_KEY = 'fake-test-key';
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRO_PRICE_ID;
  delete process.env.STRIPE_FOUNDER_PRICE_ID;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_key';
  const seen = [];
  globalThis.fetch = async (url, options) => {
    const endpoint = String(url);
    assert.ok(options.signal instanceof AbortSignal, 'upstream fetch requires abort signal');
    seen.push({ endpoint, signal: options.signal });
    if (endpoint.endsWith('/auth/v1/user')) {
      return { ok: true, status: 200, json: async () => ({ id: 'test-user' }) };
    }
    if (endpoint.endsWith('/rest/v1/rpc/reserve_eyra_usage')) {
      const reservation = JSON.parse(options.body);
      assert.equal(options.headers.apikey, 'sb_secret_test_key');
      assert.equal(options.headers.authorization, undefined);
      assert.equal(reservation.p_limit, 5);
      return { ok: true, status: 200, json: async () => [{ allowed: true, used: 1 }] };
    }
    if (endpoint === 'https://api.openai.com/v1/responses') {
      return {
        ok: true, status: 200,
        json: async () => ({
          status: 'completed', id: 'response-test', model: 'test-model',
          output: [{ content: [{ type: 'output_text', text: 'Test result' }] }],
        }),
      };
    }
    throw Error('Unexpected upstream destination');
  };
  const res = apiResponse();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer test-session' },
    body: { prompt: 'Explain this scientific result.' },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.text, 'Test result');
  assert.equal(res.body.plan, 'free');
  assert.equal(res.body.usage.limit, 5);
  assert.equal(seen.length, 3);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('EYRA fails closed when per-user usage controls are not configured', async () => {
  process.env.OPENAI_API_KEY = 'fake-test-key';
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRO_PRICE_ID;
  delete process.env.STRIPE_FOUNDER_PRICE_ID;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    const endpoint = String(url);
    seen.push(endpoint);
    assert.ok(options.signal instanceof AbortSignal);
    if (endpoint.endsWith('/auth/v1/user')) {
      return { ok: true, status: 200, json: async () => ({ id: 'test-user' }) };
    }
    throw Error('EYRA must not use OpenAI without durable quota controls');
  };
  const res = apiResponse();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer test-session' },
    body: { prompt: 'Explain this scientific result.' },
  }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'USAGE_CONTROLS_UNAVAILABLE');
  assert.equal(seen.length, 1);
  assert.equal(seen.some(url => url.includes('api.openai.com')), false);
});

test('EYRA does not call the AI model after failed authentication', async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push(String(url));
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: false, status: 401 };
  };
  const res = apiResponse();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer rejected-test-session' },
    body: { prompt: 'Hello' },
  }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(seen.length, 1);
  assert.equal(seen.some(url => url.includes('api.openai.com')), false);
});
