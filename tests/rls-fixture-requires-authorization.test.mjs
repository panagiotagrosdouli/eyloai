import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('read-only RLS probe refuses to run without authorized credentials and expected project', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-rls-two-accounts.mjs'], {
    env: { PATH: process.env.PATH || '' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RLS verification blocked/);
});

function stagingEnv(ref = 'abcdefghijklmnopqrst') {
  return { PATH: process.env.PATH || '', EYLO_ENVIRONMENT: 'staging', EYLO_STAGING_SUPABASE_REF: ref, EYLO_STAGING_CONFIRMED_REF: ref,
    EYLO_RLS_SUPABASE_URL: `https://${ref}.supabase.co`, EYLO_RLS_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    EYLO_RLS_TEST_A_EMAIL: 'fixture-a@example.invalid', EYLO_RLS_TEST_A_PASSWORD: 'fixture-password',
    EYLO_RLS_TEST_B_EMAIL: 'fixture-b@example.invalid', EYLO_RLS_TEST_B_PASSWORD: 'fixture-password' };
}
test('read-only RLS CLI rejects live/unrelated targets and secret keys before trying authentication', () => {
  for (const env of [stagingEnv('kbzjngpzxpniaumlupaa'), stagingEnv('umzrggayitzfgrrofjnw'), { ...stagingEnv(), EYLO_RLS_PUBLISHABLE_KEY: 'sb_secret_fixture' }]) {
    const result = spawnSync(process.execPath, ['scripts/verify-rls-two-accounts.mjs'], { env, encoding: 'utf8', timeout: 5000 });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /RLS verification blocked/);
  }
});
test('read-only RLS CLI checks both fixture owners across all canonical export collections without mutating data or exposing credentials', () => {
  const result = spawnSync(process.execPath, ['tests/helpers/rls-probe-fixture.mjs', 'complete'], { env: stagingEnv(), encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /31 table\(s\) with owner-row evidence, 0 inconclusive/);
  assert.doesNotMatch(result.stdout + result.stderr, /fixture-password|fixture-token/);
});
test('empty or one-sided owner fixtures return inconclusive exit2 rather than a green RLS acceptance result', () => {
  const result = spawnSync(process.execPath, ['tests/helpers/rls-probe-fixture.mjs', 'one-sided'], { env: stagingEnv(), encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /inconclusive empty table/);
});
test('same authenticated identity or leaked foreign rows fail the probe', () => {
  for (const mode of ['same-user', 'leak', 'wrong-owner']) {
    const result = spawnSync(process.execPath, ['tests/helpers/rls-probe-fixture.mjs', mode], { env: stagingEnv(), encoding: 'utf8', timeout: 5000 });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /distinct disposable|Cross-account data exposure|unexpected owner/);
  }
});
