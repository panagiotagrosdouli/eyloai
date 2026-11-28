#!/usr/bin/env node
/**
 * Exercise the production EYRA run API handler against only the disposable
 * Supabase CLI stack. The synthetic HTTPS hostname satisfies the production
 * endpoint allow-list; fetch is pinned to loopback and rejects every other host.
 */
import assert from 'node:assert/strict';
import handler from '../../api/eyra-runs.js';

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
const tokenA = process.env.EYLO_TEST_TOKEN_A;
const tokenB = process.env.EYLO_TEST_TOKEN_B;
const userA = process.env.EYLO_TEST_USER_A;
const runId = process.env.EYLO_TEST_RUN_ID;
for (const value of [apiUrl, anonKey, serviceKey, tokenA, tokenB, userA, runId]) {
  assert(value, 'Missing disposable integration-test input');
}
const target = new URL(apiUrl);
assert(['127.0.0.1', 'localhost', '::1'].includes(target.hostname) && target.port === '54321',
  'Refusing non-loopback Supabase target');

process.env.VITE_SUPABASE_URL = 'https://eylo-local-integration.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
process.env.EYRA_DURABLE_RUNS_ENABLED = 'true';

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const remote = new URL(String(input));
  assert.equal(remote.protocol, 'https:');
  assert.equal(remote.hostname, 'eylo-local-integration.supabase.co',
    'The app handler attempted to contact a non-test host');
  return nativeFetch(new URL(remote.pathname + remote.search, apiUrl), init);
};

async function invoke(method, token, { id, action } = {}) {
  const request = {
    method,
    headers: { authorization: 'Bearer ' + token },
    query: id ? { id } : {},
    body: id ? { id, ...(action ? { action } : {}) } : {},
  };
  const response = {
    code: 200,
    payload: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  await handler(request, response);
  return response;
}

const listA = await invoke('GET', tokenA);
assert.equal(listA.code, 200);
assert.equal(listA.payload.runs.length, 1);
assert.equal(listA.payload.runs[0].id, runId);
const detailA = await invoke('GET', tokenA, { id: runId });
assert.equal(detailA.code, 200);
assert.equal(detailA.payload.actions.length, 1);
const detailB = await invoke('GET', tokenB, { id: runId });
assert.equal(detailB.code, 404, 'Other owner must not retrieve run details');
const cancelB = await invoke('POST', tokenB, { id: runId, action: 'cancel' });
assert.equal(cancelB.code, 409, 'Other owner must not cancel the run');
const stillRunning = await invoke('GET', tokenA, { id: runId });
assert.equal(stillRunning.payload.run.status, 'running',
  'Rejected cross-account cancellation must not mutate run state');
const cancelA = await invoke('POST', tokenA, { id: runId, action: 'cancel' });
assert.equal(cancelA.code, 200);
assert.equal(cancelA.payload.status, 'cancelled');
const deleteB = await invoke('DELETE', tokenB, { id: runId });
assert.equal(deleteB.code, 409, 'Other owner must not delete the run');
const deleteA = await invoke('DELETE', tokenA, { id: runId });
assert.equal(deleteA.code, 200);
assert.equal(deleteA.payload.deleted, true);
console.log('PASS: EYRA production API handler authenticates users and enforces read/cancel/delete ownership against real local Supabase');

