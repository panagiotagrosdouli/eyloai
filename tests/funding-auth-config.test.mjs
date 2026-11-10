import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/opportunities.js';

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('Grants.gov refuses to authenticate against an implicit Supabase project', async (t) => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
  const previousUrl = process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_SUPABASE_URL;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('Must not contact any upstream.'); };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
  });

  const response = createResponse();
  await handler({
    method: 'GET',
    headers: { authorization: 'Bearer test-session' },
    query: { q: 'climate research' },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'SUPABASE_NOT_CONFIGURED');
  assert.equal(called, false);
});

test('Grants.gov auth uses the explicitly configured public Supabase project', async (t) => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
  const previousUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = 'sb_publishable_disposable_test';
  process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';

  let authRequest;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/v1/user')) {
      authRequest = { url: String(url), headers: options.headers };
      return { ok: true };
    }
    if (String(url) === 'https://api.grants.gov/v1/api/search2') {
      return {
        ok: true,
        json: async () => ({ errorcode: 0, data: { hitCount: 0, oppHits: [] } }),
      };
    }
    throw new Error('Unexpected upstream request in test.');
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
  });

  const response = createResponse();
  await handler({
    method: 'GET',
    headers: { authorization: 'Bearer test-session' },
    query: { q: 'climate research' },
  }, response);

  assert.equal(authRequest?.url, 'https://eylo-test.supabase.co/auth/v1/user');
  assert.equal(authRequest?.headers?.apikey, 'sb_publishable_disposable_test');
  assert.equal(authRequest?.headers?.authorization, 'Bearer test-session');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, 'Grants.gov');
});
