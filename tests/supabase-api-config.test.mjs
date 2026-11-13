import test from 'node:test';
import assert from 'node:assert/strict';
import { readSupabaseApiConfig } from '../server/supabase-config.mjs';

test('serverless Supabase configuration fails closed when project URL is missing', () => {
  const config = readSupabaseApiConfig({
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  });

  assert.equal(config.url, '');
  assert.equal(config.hasPublicConfig, false);
  assert.equal(config.hasServerConfig, false);
});

test('serverless Supabase configuration rejects non-Supabase and unsafe URLs', () => {
  for (const url of [
    'https://example.com',
    'http://tenant.supabase.co',
    'https://user:pass@tenant.supabase.co',
    'https://tenant.supabase.co:8443',
    'https://tenant.supabase.co/other-project',
  ]) {
    const config = readSupabaseApiConfig({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
    });
    assert.equal(config.hasPublicConfig, false, url);
    assert.equal(config.hasServerConfig, false, url);
  }
});

test('serverless Supabase configuration accepts an explicit project and separates public/server keys', () => {
  const config = readSupabaseApiConfig({
    VITE_SUPABASE_URL: 'https://eylo-test.supabase.co/',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  });

  assert.equal(config.url, 'https://eylo-test.supabase.co');
  assert.equal(config.publicKey, 'sb_publishable_test');
  assert.equal(config.serverKey, 'sb_secret_test');
  assert.equal(config.hasPublicConfig, true);
  assert.equal(config.hasServerConfig, true);
});
