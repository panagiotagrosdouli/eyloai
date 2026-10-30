import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import handler from '../api/eyra.js';

const beforeFetch = globalThis.fetch;
after(() => { globalThis.fetch = beforeFetch; });

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('EYRA returns a retryable 504 when authentication upstream times out', async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push(String(url));
    assert.ok(options.signal instanceof AbortSignal);
    const error = new Error('Upstream timed out');
    error.name = 'TimeoutError';
    throw error;
  };
  const res = response();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer simulated-session' },
    body: { prompt: 'Research question' },
  }, res);
  assert.equal(res.statusCode, 504);
  assert.equal(res.body.code, 'UPSTREAM_TIMEOUT');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(seen.length, 1);
  assert.equal(seen.some(url => url.includes('api.openai.com')), false);
});
