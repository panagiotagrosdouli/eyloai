import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { durableRunsEnabled } from '../server/eyra-run-ledger.mjs';
import handler from '../api/eyra-runs.js';

const projectRef = 'abcdefghijklmnopqrst';
const valid = {
  EYRA_DURABLE_RUNS_ENABLED: 'true',
  EYLO_ENVIRONMENT: 'staging',
  EYLO_STAGING_SUPABASE_REF: projectRef,
  EYLO_STAGING_CONFIRMED_REF: projectRef,
  VITE_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'fixture-public',
  SUPABASE_SECRET_KEY: 'fixture-server',
};
const names = Object.keys(valid);
const original = Object.fromEntries(names.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of names) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  globalThis.fetch = originalFetch;
});
function deniedResponse() {
  return {
    code: 200,
    data: null,
    setHeader() { return this; },
    status(value) { this.code = value; return this; },
    json(value) { this.data = value; return this; },
  };
}

test('staging ledger gate rejects production and unknown deployment identities', () => {
  const changes = [
    { EYRA_DURABLE_RUNS_ENABLED: 'false' },
    { EYLO_ENVIRONMENT: 'production' },
    { EYLO_STAGING_CONFIRMED_REF: 'zyxwvutsrqponmlkjihg' },
    { EYLO_STAGING_SUPABASE_REF: 'zyxwvutsrqponmlkjihg' },
    { SUPABASE_SECRET_KEY: '' },
    { SUPABASE_PUBLISHABLE_KEY: '' },
    { VITE_SUPABASE_URL: 'https://kbzjngpzxpniaumlupaa.supabase.co',
      EYLO_STAGING_SUPABASE_REF: 'kbzjngpzxpniaumlupaa',
      EYLO_STAGING_CONFIRMED_REF: 'kbzjngpzxpniaumlupaa' },
    { VITE_SUPABASE_URL: 'https://umzrggayitzfgrrofjnw.supabase.co',
      EYLO_STAGING_SUPABASE_REF: 'umzrggayitzfgrrofjnw',
      EYLO_STAGING_CONFIRMED_REF: 'umzrggayitzfgrrofjnw' },
    { VITE_SUPABASE_URL: 'http://abcdefghijklmnopqrst.supabase.co' },
    { VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co.evil.example' },
  ];
  assert.equal(durableRunsEnabled(valid), true);
  for (const patch of changes) {
    const env = { ...valid, ...patch };
    assert.equal(durableRunsEnabled(env), false, JSON.stringify(patch));
  }
});

test('agent history API denies production requests before authenticated network or DB writes', async () => {
  Object.assign(process.env, valid, { EYLO_ENVIRONMENT: 'production' });
  let calls = 0;
  globalThis.fetch = () => {
    calls += 1;
    throw new Error('Provider or database must never be contacted');
  };
  const response = deniedResponse();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer fixture-token' },
    body: { id: '10000000-0000-4000-8000-000000000001', action: 'cancel' },
  }, response);
  assert.equal(response.code, 503);
  assert.equal(response.data.code, 'AGENT_LEDGER_UNAVAILABLE');
  assert.equal(calls, 0);
});
