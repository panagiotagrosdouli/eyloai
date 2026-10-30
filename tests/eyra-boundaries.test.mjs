import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import handler from '../api/eyra.js';

const originalFetch = globalThis.fetch;
const requests = [];
const originalApiKey = process.env.OPENAI_API_KEY;

after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('EYRA does not expose the AI endpoint through GET requests', async () => {
  globalThis.fetch = async (...args) => { requests.push(args); throw Error('Network must not be used'); };
  const result = response();
  await handler({ method: 'GET', headers: {}, body: {} }, result);
  assert.equal(result.statusCode, 405);
  assert.equal(result.headers.Allow, 'POST');
  assert.equal(requests.length, 0);
});

test('EYRA rejects missing authentication without external network calls', async () => {
  requests.length = 0;
  globalThis.fetch = async (...args) => { requests.push(args); throw Error('Network must not be used'); };
  const result = response();
  await handler({ method: 'POST', headers: {}, body: { prompt: 'Summarize research' } }, result);
  assert.equal(result.statusCode, 401);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal(result.body.error, 'Authentication required.');
  assert.equal(requests.length, 0);
});

test('EYRA rejects an empty bearer token without calling Supabase or OpenAI', async () => {
  requests.length = 0;
  globalThis.fetch = async (...args) => { requests.push(args); throw Error('Network must not be used'); };
  const result = response();
  await handler({
    method: 'POST', headers: { authorization: 'Bearer ' }, body: { prompt: 'Analyze research' },
  }, result);
  assert.equal(result.statusCode, 401);
  assert.equal(requests.length, 0);
});

test('EYRA does not reach OpenAI when Supabase rejects a session', async () => {
  requests.length = 0;
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    assert.match(String(url), /\/auth\/v1\/user$/);
    return { ok: false, status: 401 };
  };
  process.env.OPENAI_API_KEY = 'fake-test-token';
  const result = response();
  await handler({
    method: 'POST', headers: { authorization: 'Bearer invalid-test-session' },
    body: { prompt: 'Explain a scientific method' },
  }, result);
  assert.equal(result.statusCode, 401);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal(requests.length, 1);
  assert.equal(requests.some(url => url.includes('api.openai.com')), false);
});
