import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import handler from '../api/opportunities.js';

test('Grants.gov auth uses the public client key when server env is absent', async () => {
  const envText = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
  const expectedKey = envText.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
  assert.ok(expectedKey, 'public Supabase key is present in the production client configuration');

  const previousFetch = globalThis.fetch;
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
  const previousUrl = process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_SUPABASE_URL;

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

  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };

  try {
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer test-session' }, query: { q: 'climate research' } },
      response,
    );
    assert.equal(authRequest?.url, 'https://kbzjngpzxpniaumlupaa.supabase.co/auth/v1/user');
    assert.equal(authRequest?.headers?.apikey === expectedKey, true, 'server auth key matches the public client key');
    assert.equal(authRequest?.headers?.authorization, 'Bearer test-session');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.source, 'Grants.gov');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousUrl;
  }
});
