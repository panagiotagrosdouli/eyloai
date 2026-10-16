import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

function responseMock() {
  return {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('EYRA does not silently truncate oversized research instructions', async () => {
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'test-researcher' }), { status: 200 });
    }
    throw new Error('An oversized prompt must not reach OpenAI or another service');
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer example-test-token' },
      body: { prompt: 'a'.repeat(25_000) },
    }, response);
    assert.equal(response.statusCode, 413);
    assert.equal(response.payload.code, 'PROMPT_TOO_LONG');
    assert.equal(response.headers['cache-control'], 'private, no-store');
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test('unauthenticated EYRA errors are explicitly private and uncached', async () => {
  const response = responseMock();
  await handler({ method: 'POST', headers: {}, body: { prompt: 'Research this' } }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.headers['cache-control'], 'private, no-store');
});
