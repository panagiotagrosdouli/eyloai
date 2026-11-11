import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from '../src/lib/config/env.js';

test('missing Supabase values fail closed without project fallbacks', () => {
  const result = validateEnvironment({});

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ]);
  assert.deepEqual(result.values, {
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
  });
});

test('explicit valid Supabase configuration is accepted', () => {
  const result = validateEnvironment({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.invalid, []);
});

test('invalid Supabase URLs are rejected', () => {
  const result = validateEnvironment({
    VITE_SUPABASE_URL: 'https://example.com',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.invalid, ['VITE_SUPABASE_URL']);
});

test('production frontend refuses any other Supabase tenant', () => {
  const approved = validateEnvironment({
    PROD: true,
    VITE_SUPABASE_URL: 'https://kbzjngpzxpniaumlupaa.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  });
  assert.equal(approved.ok, true);

  const wrong = validateEnvironment({
    PROD: true,
    VITE_SUPABASE_URL: 'https://other-tenant.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
  });
  assert.equal(wrong.ok, false);
  assert.deepEqual(wrong.invalid, ['VITE_SUPABASE_URL']);
});

test('frontend rejects Supabase URLs with credentials, paths or query strings', () => {
  for (const url of [
    'https://user:pass@kbzjngpzxpniaumlupaa.supabase.co',
    'https://kbzjngpzxpniaumlupaa.supabase.co/custom',
    'https://kbzjngpzxpniaumlupaa.supabase.co/?token=private',
    'https://kbzjngpzxpniaumlupaa.supabase.co:444',
  ]) {
    assert.equal(validateEnvironment({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'test' }).ok, false, url);
  }
});
