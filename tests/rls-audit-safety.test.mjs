import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPlan, verifiedSupabaseOrigin, USER_OWNED_TABLES } from '../src/lib/rls-audit-guards.mjs';

const exampleRef = 'abcdefghijklmnopqrst';
const url = `https://${exampleRef}.supabase.co`;
const config = {
  EYLO_RLS_LIVE: '1',
  EYLO_RLS_SUPABASE_URL: url,
  EYLO_RLS_CONFIRMED_PRODUCTION_URL: url,
  EYLO_RLS_EXPECTED_PROJECT_REF: exampleRef,
  EYLO_RLS_PUBLIC_KEY: 'sb_publishable_example',
  EYLO_RLS_TOKEN_A: 'disposable-token-a',
  EYLO_RLS_TOKEN_B: 'disposable-token-b',
};

test('RLS audit defaults to no-network preflight', () => {
  assert.deepEqual(auditPlan({}, []).mode, 'preflight');
  assert.ok(USER_OWNED_TABLES.includes('saved_papers'));
});

test('live audit needs explicit opt-in and matching production ref', () => {
  assert.throws(() => auditPlan({ ...config, EYLO_RLS_LIVE: undefined }, ['--live']));
  assert.throws(() => auditPlan({ ...config, EYLO_RLS_EXPECTED_PROJECT_REF: 'zzzzzzzzzzzzzzzzzzzz' }, ['--live']), /exact HTTPS origin/);
  assert.equal(auditPlan(config, ['--live']).origin, url);
});

test('audit target cannot be redirected to attacker-controlled or unrelated hosts', () => {
  for (const candidate of [
    'https://example.org', 'http://abcdefghijklmnopqrst.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co.evil.test',
    'https://abcdefghijklmnopqrst.supabase.co/rest/v1',
    'https://username@abcdefghijklmnopqrst.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co?foo=1',
  ]) assert.throws(() => verifiedSupabaseOrigin(candidate, exampleRef));
});

test('server-only service keys and reused tokens are forbidden', () => {
  assert.throws(() => auditPlan({ ...config, EYLO_RLS_PUBLIC_KEY: 'sb_secret_not_allowed' }, ['--live']));
  const forgedPrivilegedKey = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.signature';
  assert.throws(() => auditPlan({ ...config, EYLO_RLS_PUBLIC_KEY: forgedPrivilegedKey }, ['--live']));
  assert.throws(() => auditPlan({ ...config, EYLO_RLS_TOKEN_B: config.EYLO_RLS_TOKEN_A }, ['--live']));
});

test('cross-account mutation needs an independent deliberate confirmation', () => {
  assert.throws(() => auditPlan(config, ['--write-test-fixtures']));
  assert.throws(() => auditPlan(config, ['--live', '--write-test-fixtures']), /Fixture writes require/);
  assert.equal(auditPlan({ ...config, EYLO_RLS_TEST_WRITES: 'DISPOSABLE_ACCOUNTS_ONLY' }, ['--live', '--write-test-fixtures']).writes, true);
});

test('cannot specify arbitrary tables or unknown command-line flags', () => {
  assert.throws(() => auditPlan({ ...config, EYLO_RLS_TABLES: 'auth.users' }, ['--live']));
  assert.throws(() => auditPlan(config, ['--live', '--delete-everything']));
  assert.deepEqual(auditPlan({ ...config, EYLO_RLS_TABLES: 'projects,saved_papers' }, ['--live']).tables, ['projects', 'saved_papers']);
});
