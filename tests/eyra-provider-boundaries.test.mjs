import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

const envNames = ['VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'OPENAI_API_KEY'];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_disposable_test';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_disposable_test';
after(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

function responseMock() {
  return {
    statusCode: 200, payload: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}

function request() {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer disposable-test-jwt' },
    body: { prompt: 'Explain the evidence limits of this project.' },
  };
}

function mockServices(provider) {
  const events = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'test-user-a' }), { status: 200 });
    }
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) {
      events.push('reserved');
      return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    }
    if (address.endsWith('/rest/v1/rpc/release_eyra_usage')) {
      events.push('released');
      return new Response('true', { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      events.push('provider');
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 4096);
      assert.equal(body.input, request().body.prompt);
      return provider(body);
    }
    throw new Error('Unexpected mocked request: ' + address);
  };
  return events;
}

test('EYRA applies an explicit output ceiling to a successful mocked Responses call', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
  const events = mockServices(() => new Response(JSON.stringify({
    id: 'resp_mocked', status: 'completed', model: 'test-model',
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'Evidence is limited.' }] }],
  }), { status: 200 }));
  const response = responseMock();
  await handler(request(), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.text, 'Evidence is limited.');
  assert.deepEqual(events, ['reserved', 'provider']);
});

test('EYRA maps provider HTTP 429 to a retryable service error and refunds reservation', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
  const events = mockServices(() => new Response(JSON.stringify({ error: { message: 'Do not expose provider diagnostics' } }), {
    status: 429, headers: { 'x-request-id': 'req_disposable' },
  }));
  const response = responseMock();
  await handler(request(), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'OPENAI_RATE_LIMITED');
  assert.doesNotMatch(JSON.stringify(response.payload), /Do not expose provider diagnostics/);
  assert.deepEqual(events, ['reserved', 'provider', 'released']);
});

test('EYRA reports missing OpenAI configuration without reserving usage or contacting provider', async () => {
  delete process.env.OPENAI_API_KEY;
  const events = mockServices(() => { throw new Error('Provider must not be called'); });
  const response = responseMock();
  await handler(request(), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'OPENAI_NOT_CONFIGURED');
  assert.deepEqual(events, []);
});


test('EYRA distinguishes an exhausted API budget from transient throttling without retries', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
  const events = mockServices(() => new Response(JSON.stringify({
    error: { code: 'insufficient_quota', message: 'Private account billing details must never leak' },
  }), { status: 429, headers: { 'retry-after': '1' } }));
  const response = responseMock();
  await handler(request(), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'OPENAI_QUOTA_EXHAUSTED');
  assert.doesNotMatch(JSON.stringify(response.payload), /Private account billing details/);
  assert.deepEqual(events, ['reserved', 'provider', 'released']);
});

test('EYRA retries at most once for an explicitly short transient provider limit', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
  let attempts = 0;
  const events = mockServices(() => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }),
        { status: 429, headers: { 'retry-after': '0' } });
    }
    return new Response(JSON.stringify({
      id: 'resp_after_retry', status: 'completed', model: 'test-model',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Retrieved analysis.' }] }],
    }), { status: 200 });
  });
  const response = responseMock();
  await handler(request(), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.text, 'Retrieved analysis.');
  assert.equal(attempts, 2);
  assert.deepEqual(events, ['reserved', 'provider', 'provider']);
});

test('EYRA publishes bounded Retry-After when throttling persists', async () => {
  process.env.OPENAI_API_KEY = 'sk-test-placeholder-only';
  const events = mockServices(() => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), {
    status: 429, headers: { 'retry-after': '45' },
  }));
  const response = responseMock();
  await handler(request(), response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.code, 'OPENAI_RATE_LIMITED');
  assert.equal(response.payload.retry_after_seconds, 45);
  assert.equal(response.headers['retry-after'], '45');
  assert.deepEqual(events, ['reserved', 'provider', 'released']);
});
