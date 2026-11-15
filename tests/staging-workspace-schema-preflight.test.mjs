import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStagingSchemaConfig, verifyStagingWorkspaceSchema, WORKSPACE_SCHEMA_CONTRACTS } from '../scripts/verify-workspace-schema-staging.mjs';

const valid = {
  EYLO_ENVIRONMENT: 'staging',
  EYLO_STAGING_SUPABASE_REF: 'abcdefghijklmnopqrst',
  EYLO_STAGING_CONFIRMED_REF: 'abcdefghijklmnopqrst',
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'disposable-public-test-key',
  EYLO_STAGING_TEST_JWT: 'disposable-user-token',
};

test('schema preflight rejects production, unrelated, unconfirmed and mismatched staging projects', () => {
  for (const patch of [
    { EYLO_ENVIRONMENT: 'production' },
    { EYLO_STAGING_SUPABASE_REF: 'kbzjngpzxpniaumlupaa', EYLO_STAGING_CONFIRMED_REF: 'kbzjngpzxpniaumlupaa', VITE_SUPABASE_URL: 'https://kbzjngpzxpniaumlupaa.supabase.co' },
    { EYLO_STAGING_SUPABASE_REF: 'umzrggayitzfgrrofjnw', EYLO_STAGING_CONFIRMED_REF: 'umzrggayitzfgrrofjnw', VITE_SUPABASE_URL: 'https://umzrggayitzfgrrofjnw.supabase.co' },
    { EYLO_STAGING_CONFIRMED_REF: 'aaaaaaaaaaaaaaaaaaaa' },
    { VITE_SUPABASE_URL: 'https://wrong.supabase.co' },
    { EYLO_STAGING_TEST_JWT: '' },
  ]) assert.throws(() => assertStagingSchemaConfig({ ...valid, ...patch }), /staging Supabase/);
});

test('schema preflight verifies actual table and column selections using HEAD only', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url, options });
    return { ok: true, status: 200 };
  };
  const result = await verifyStagingWorkspaceSchema(valid, fetchImpl);
  assert.equal(result.decision, 'PASS');
  assert.equal(result.checked, WORKSPACE_SCHEMA_CONTRACTS.length);
  assert.ok(seen.every(({ options }) => options.method === 'HEAD'));
  assert.ok(seen.some(({ url }) => url.includes('/rest/v1/projects?select=id%2Cuser_id%2Ccreated_date%2Cupdated_date')));
  assert.ok(seen.some(({ url }) => url.includes('/rest/v1/eylo_files?select=id%2Cuser_id%2Cproject_id%2Cupdated_at')));
  assert.doesNotMatch(JSON.stringify(result), /disposable-user-token|disposable-public-test-key|supabase\.co/);
});

test('a missing table or column blocks staging acceptance and never claims success', async () => {
  const result = await verifyStagingWorkspaceSchema(valid, async url => ({
    ok: !url.includes('/eylo_files?'),
    status: url.includes('/eylo_files?') ? 404 : 200,
  }));
  assert.equal(result.decision, 'FAIL');
  assert.deepEqual(result.results.find(row => row.table === 'eylo_files'), {
    table: 'eylo_files',
    status: 'schema_or_visibility_failure',
    http_status: 404,
  });
});

test('network errors are reported per table without leaking secrets or failing open', async () => {
  const result = await verifyStagingWorkspaceSchema(valid, async () => { throw new Error('secret stuff'); });
  assert.equal(result.decision, 'FAIL');
  assert.equal(result.results.length, WORKSPACE_SCHEMA_CONTRACTS.length);
  assert.ok(result.results.every(row => row.status === 'connection_failed'));
  assert.doesNotMatch(JSON.stringify(result), /secret stuff/);
});
