import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/billing.js';

function mockResponse() {
  return {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('billing does not reveal internal provider failures to clients', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
  globalThis.fetch = async () => { throw new Error('private provider details should never leak'); };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });
  const response = mockResponse();
  await handler({ method: 'GET', headers: { authorization: 'Bearer test-token' } }, response);
  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.payload, {
    error: 'Billing is temporarily unavailable.',
    code: 'BILLING_REQUEST_FAILED',
  });
  assert.doesNotMatch(JSON.stringify(response.payload), /private provider details/);
});

test('billing rejects unsupported HTTP methods without reaching providers', async () => {
  const response = mockResponse();
  await handler({ method: 'PUT', headers: {} }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET, POST');
});
