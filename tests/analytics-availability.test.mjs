import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admin-analytics.js';
import { validWorkspaceAnalyticsPayload } from '../src/lib/analytics-readiness.mjs';

const analyticsEnvKeys = [
  'EYLO_ANALYTICS_ENABLED',
  'VITE_SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
];
const priorEnv = Object.fromEntries(analyticsEnvKeys.map(key => [key, process.env[key]]));
const priorFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = priorFetch;
  for (const key of analyticsEnvKeys) {
    if (priorEnv[key] === undefined) delete process.env[key];
    else process.env[key] = priorEnv[key];
  }
});

function clearAnalyticsEnv() {
  for (const key of analyticsEnvKeys) delete process.env[key];
}

function configureAnalytics() {
  process.env.EYLO_ANALYTICS_ENABLED = '1';
  process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_disposable';
}

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(data) { this.body = data; return this; },
  };
}

function payload() {
  return {
    scope: 'personal',
    institution_id: 'test-only',
    institution_name: 'Research workspace',
    members: 1,
    ai_actions_this_month: 2,
    generated_at: '2026-11-06T00:00:00Z',
    counts: {
      projects: 0, saved_papers: 1, saved_researchers: 0,
      saved_opportunities: 0, meetings: 0, watchlists: 0,
    },
  };
}

test('disabled Analytics rejects authorized calls without accessing Supabase', async () => {
  clearAnalyticsEnv();
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('No database calls allowed'); };
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-token' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'ANALYTICS_NOT_ENABLED');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(calls, 0);
});

test('enabled Analytics without explicit Supabase config fails closed without network access', async () => {
  clearAnalyticsEnv();
  process.env.EYLO_ANALYTICS_ENABLED = '1';
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('No database calls allowed'); };
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-token' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'ANALYTICS_NOT_CONFIGURED');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(calls, 0);
});

test('missing or invalid authentication never makes a database call', async () => {
  configureAnalytics();
  globalThis.fetch = async () => { throw Error('No upstream call allowed'); };
  for (const headers of [{}, { authorization: 'Bearer ' }, { authorization: 'Basic wrong' }]) {
    const res = response();
    await handler({ method: 'GET', headers }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});

test('invalid Supabase URL fails closed without network access', async () => {
  configureAnalytics();
  process.env.VITE_SUPABASE_URL = 'https://not-supabase.example';
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('No database calls allowed'); };
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-token' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'ANALYTICS_NOT_CONFIGURED');
  assert.equal(calls, 0);
});

test('explicitly configured analytics delegates to same-user Supabase RPC and retains no-store', async () => {
  configureAnalytics();
  let called = 0;
  globalThis.fetch = async (url, opts) => {
    called++;
    assert.equal(String(url), 'https://test-project.supabase.co/rest/v1/rpc/get_workspace_analytics');
    assert.equal(opts.method, 'POST');
    assert.equal(opts.headers.authorization, 'Bearer disposable-token');
    assert.equal(opts.headers.apikey, 'sb_publishable_disposable');
    assert.equal(opts.cache, 'no-store');
    return { ok: true, status: 200, json: async () => payload() };
  };
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-token' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, payload());
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(called, 1);
});

test('malformed successful RPC responses are rejected rather than displayed', async () => {
  configureAnalytics();
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ counts: {} }) });
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-token' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'ANALYTICS_INVALID_RESPONSE');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(validWorkspaceAnalyticsPayload({ counts: {} }), false);
  assert.equal(validWorkspaceAnalyticsPayload(payload()), true);
});

test('upstream permission failures are not treated as empty analytics', async () => {
  configureAnalytics();
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer disposable-token' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});
