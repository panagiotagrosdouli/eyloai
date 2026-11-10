import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_TABLES, validatePageRequest } from '../api/privacy-export.js';

test('rejects arbitrary tables and identity selectors', () => {
  assert.equal(validatePageRequest({ table: 'auth.users', offset: '0' }), null);
  assert.equal(validatePageRequest({ table: 'stripe_webhook_events', offset: '0' }), null);
  assert.equal(validatePageRequest({ table: 'profiles', offset: '-1' }), null);
  assert.equal(validatePageRequest({ table: 'profiles', offset: '1' }), null);
  assert.equal(validatePageRequest({ table: 'profiles', offset: '999999999999999999999999' }), null);
  assert.deepEqual(validatePageRequest({ table: 'projects', offset: '200', user_id: 'someone-else' }),
    { table: 'projects', offset: 200 });
});
test('export catalog includes all first-party user data tables in versioned migrations', () => {
  for (const table of ['projects', 'ideas', 'meetings', 'saved_papers', 'saved_researchers',
    'saved_opportunities', 'search_history', 'watchlists', 'notifications',
    'monitoring_discoveries', 'profiles', 'billing_entitlements', 'eyra_usage_actions',
    'institution_memberships']) assert.ok(EXPORT_TABLES.includes(table));
});

import handler from '../api/privacy-export.js';

function responseRecorder() {
  const response = {
    headers: {}, statusCode: 200, payload: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
    end() { return this; },
  };
  return response;
}
function request(authorization = 'Bearer disposable-token', query = { table: 'projects', offset: '0' }) {
  return { method: 'GET', headers: { authorization }, query };
}

test('anonymous requests do not read data', async () => {
  const result = responseRecorder();
  await handler(request(undefined), result);
  assert.notEqual(result.statusCode, 200);
});

test('verified user ID, not browser user_id, scopes privileged database query', async () => {
  const old = { ...process.env };
  const previousFetch = globalThis.fetch;
  try {
    process.env.SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    const seen = [];
    const verifiedId = '12345678-1234-1234-1234-123456789abc';
    globalThis.fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      return {
        ok: true,
        json: async () => url.endsWith('/auth/v1/user')
          ? { id: verifiedId } : [{ id: 'row-1', user_id: verifiedId }],
      };
    };
    const result = responseRecorder();
    await handler(request('Bearer disposable-token', {
      table: 'projects', offset: '0', user_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    }), result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.rows.length, 1);
    assert.ok(seen[1].includes('user_id=eq.' + verifiedId));
    assert.ok(!seen[1].includes('ffffffff-ffff'));
  } finally {
    process.env = old;
    globalThis.fetch = previousFetch;
  }
});

test('data source errors fail without returning partial records', async () => {
  const old = { ...process.env };
  const previousFetch = globalThis.fetch;
  try {
    process.env.SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    globalThis.fetch = async (input) => ({
      ok: String(input).endsWith('/auth/v1/user'),
      json: async () => ({ id: '12345678-1234-1234-1234-123456789abc' }),
    });
    const result = responseRecorder();
    await handler(request(), result);
    assert.equal(result.statusCode, 502);
    assert.equal('rows' in result.payload, false);
  } finally {
    process.env = old;
    globalThis.fetch = previousFetch;
  }
});
