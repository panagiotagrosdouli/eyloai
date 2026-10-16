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
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
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
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('unauthenticated EYRA errors are explicitly private and uncached', async () => {
  const response = responseMock();
  await handler({ method: 'POST', headers: {}, body: { prompt: 'Research this' } }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.headers['cache-control'], 'private, no-store');
});

test('EYRA rejects a partial OpenAI generation even when it contains text', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'test-researcher' }), { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      return new Response(JSON.stringify({
        id: 'resp_incomplete',
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [{ content: [{ type: 'output_text', text: 'Partial report' }] }],
      }), { status: 200 });
    }
    throw new Error('Unexpected test request: ' + address);
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer example-test-token' },
      body: { prompt: 'Analyze this saved research topic' },
    }, response);
    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.code, 'EYRA_INCOMPLETE');
    assert.equal(response.headers['cache-control'], 'private, no-store');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('EYRA records a failed quota refund when rollback RPC returns HTTP error', async () => {
  const source = (await import('node:fs')).readFileSync(
    new URL('../api/eyra.js', import.meta.url), 'utf8',
  );
  assert.match(source, /const rollback = await fetch\(/);
  assert.match(source, /if \(!rollback\.ok\)/);
  assert.match(source, /EYRA usage rollback was rejected/);
});
