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
  EYLO_STORAGE_APPROVED_PREVIEW_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  VERCEL_GIT_COMMIT_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  EYLO_STORAGE_APPROVED_PREVIEW_URL: 'https://eyloai-test-preview.vercel.app/',
  VERCEL_URL: 'eyloai-test-preview.vercel.app',
  EYLO_STORAGE_APPROVED_CLEANUP_SCOPE: 'generated-fixtures-only',
  EYLO_STORAGE_TEST_A_INBOX_AUTHORIZED: 'YES', EYLO_STORAGE_TEST_B_INBOX_AUTHORIZED: 'YES',
};

test('Storage acceptance requires an exact isolated staging target and explicit disposable-write acknowledgement', () => {
  assert.equal(validateEyloStorageStagingConfig(valid).ok, true);
  const cases = [
    { EYLO_STAGING_SUPABASE_REF: 'kbzjngpzxpniaumlupaa' },
    { EYLO_STAGING_CONFIRMED_REF: 'zyxwvutsrqponmlkjihg' },
    { EYLO_STORAGE_SUPABASE_URL: 'https://other.supabase.co' },
    { VITE_SUPABASE_URL: 'https://other.supabase.co' },
    { EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES: 'NO' },
    { EYLO_STORAGE_PUBLISHABLE_KEY: 'sb_secret_fixture' },
    { EYLO_STORAGE_TEST_B_EMAIL: 'STORAGE-A@example.invalid' },
    { VERCEL_ENV: 'production' },
    { EYLO_STORAGE_APPROVED_PREVIEW_SHA: '' },
    { EYLO_STORAGE_APPROVED_PREVIEW_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    { VERCEL_GIT_COMMIT_SHA: '' },
    { EYLO_STORAGE_APPROVED_PREVIEW_URL: 'https://eyloai.vercel.app/' },
    { EYLO_STORAGE_APPROVED_PREVIEW_URL: 'http://eyloai-test-preview.vercel.app/' },
    { VERCEL_URL: 'eyloai-production.vercel.app' },
    { EYLO_STORAGE_APPROVED_CLEANUP_SCOPE: 'all-files' },
    { EYLO_STORAGE_TEST_A_INBOX_AUTHORIZED: 'NO' },
    { EYLO_STORAGE_TEST_B_INBOX_AUTHORIZED: '' },
    { VERCEL_ENV: '' },
    { VITE_SUPABASE_USE_PROXY: '' },
    { VITE_SUPABASE_USE_PROXY: 'true' },
  ];
  for (const change of cases) assert.equal(validateEyloStorageStagingConfig({ ...valid, ...change }).ok, false);
});

test('invalid Storage acceptance configuration fails before any network client is constructed', () => {
  const result = validateEyloStorageStagingConfig({ ...valid, EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES: '' });
  assert.equal(result.ok, false);
  assert.equal(result.url, null);
  assert.equal(result.projectRef, null);
});
