import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEyloStorageStagingConfig } from '../scripts/eylo-file-storage-staging-core.mjs';

const valid = {
  EYLO_ENVIRONMENT: 'staging', VERCEL_ENV: 'preview',
  EYLO_STAGING_SUPABASE_REF: 'abcdefghijklmnopqrst', EYLO_STAGING_CONFIRMED_REF: 'abcdefghijklmnopqrst',
  EYLO_STORAGE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  EYLO_STORAGE_PUBLISHABLE_KEY: 'sb_publishable_fixture', VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  EYLO_STORAGE_TEST_A_EMAIL: 'storage-a@example.invalid', EYLO_STORAGE_TEST_A_PASSWORD: 'disposable-a',
  EYLO_STORAGE_TEST_B_EMAIL: 'storage-b@example.invalid', EYLO_STORAGE_TEST_B_PASSWORD: 'disposable-b',
  EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES: 'YES', VITE_SUPABASE_USE_PROXY: 'false',
};

test('Storage acceptance requires an exact isolated staging target and explicit disposable-write acknowledgement', () => {
  assert.equal(validateEyloStorageStagingConfig(valid).ok, true);
  const cases = [
    { EYLO_STAGING_SUPABASE_REF: 'kbzjngpzxpniaumlupaa' },
    { EYLO_STAGING_CONFIRMED_REF: 'zyxwvutsrqponmlkjihg' },
    { EYLO_STORAGE_SUPABASE_URL: 'https://other.supabase.co' },
    { EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES: 'NO' },
    { EYLO_STORAGE_PUBLISHABLE_KEY: 'sb_secret_fixture' },
    { EYLO_STORAGE_TEST_B_EMAIL: 'STORAGE-A@example.invalid' },
    { VERCEL_ENV: 'production' },
  ];
  for (const change of cases) assert.equal(validateEyloStorageStagingConfig({ ...valid, ...change }).ok, false);
});

test('invalid Storage acceptance configuration fails before any network client is constructed', () => {
  const result = validateEyloStorageStagingConfig({ ...valid, EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES: '' });
  assert.equal(result.ok, false);
  assert.equal(result.url, null);
  assert.equal(result.projectRef, null);
});
