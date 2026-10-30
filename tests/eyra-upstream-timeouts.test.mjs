import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import handler from '../api/eyra.js';

const previousFetch = globalThis.fetch;
const previousOpenAIKey = process.env.OPENAI_API_KEY;
const previousServerKeys = {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
};
after(() => {
  globalThis.fetch = previousFetch;
  if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenAIKey;
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
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    const endpoint = String(url);
    assert.ok(options.signal instanceof AbortSignal, 'upstream fetch requires abort signal');
    seen.push({ endpoint, signal: options.signal });
    if (endpoint.endsWith('/auth/v1/user')) {
      return { ok: true, status: 200, json: async () => ({ id: 'test-user' }) };
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
  assert.equal(seen.length, 2);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
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
