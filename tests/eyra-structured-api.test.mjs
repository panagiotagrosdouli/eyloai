import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

function responseMock() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('malformed scientific schema result never reaches UI and releases quota', async () => {
  const originals = Object.fromEntries(
    ['VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'OPENAI_API_KEY', 'VERCEL_ENV']
      .map(key => [key, process.env[key]]),
  );
  const originalFetch = globalThis.fetch;
  process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_disposable_test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_disposable_test';
  process.env.OPENAI_API_KEY = 'sk-test-no-live-model';
  delete process.env.VERCEL_ENV;
  let refunds = 0;
  let aiCalls = 0;
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'researcher-one' }), { status: 200 });
    if (address.endsWith('/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address.endsWith('/rpc/release_eyra_usage')) {
      refunds++;
      return new Response('true', { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      aiCalls++;
      return new Response(JSON.stringify({
        id: 'mock_ai_response',
        status: 'completed',
        model: 'test-model',
        output: [{ content: [{ type: 'output_text', text: '{"findings":[{"claim":"Claim without source"}]}' }] }],
      }), { status: 200 });
    }
    throw new Error('Unexpected endpoint: ' + address);
  };

  try {
    const response = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer disposable-token' },
      body: {
        prompt: 'Check whether the study supports a given claim',
        response_json_schema: {
          type: 'object', properties: {
            findings: { type: 'array', items: {
              type: 'object', properties: {
                claim: { type: 'string' }, source_id: { type: 'string' },
              },
            } },
          },
        },
      },
    }, response);
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.code, 'EYRA_SCHEMA_MISMATCH');
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(aiCalls, 1);
    assert.equal(refunds, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
