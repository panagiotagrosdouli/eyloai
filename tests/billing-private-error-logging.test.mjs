import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/billing.js';

test('billing endpoint does not log upstream private customer details', async () => {
  const originals = {
    fetch: globalThis.fetch,
    error: console.error,
    url: process.env.VITE_SUPABASE_URL,
    publicKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  };
  const privateText = 'PRIVATE_BILLING_CUSTOMER_DATA_DO_NOT_LOG';
  const logged = [];
  process.env.VITE_SUPABASE_URL = 'https://billing-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
  globalThis.fetch = async () => { throw new Error(privateText); };
  console.error = (...args) => logged.push(args);
  const response = {
    statusCode: 200, body: null,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  try {
    await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-test-session' } }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(JSON.stringify(logged).includes(privateText), false);
    assert.equal(JSON.stringify(response.body).includes(privateText), false);
    assert.equal(logged[0][0], 'Billing endpoint error');
    assert.deepEqual(logged[0][1], { error_class: 'Error' });
  } finally {
    globalThis.fetch = originals.fetch;
    console.error = originals.error;
    if (originals.url === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originals.url;
    if (originals.publicKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originals.publicKey;
  }
});
