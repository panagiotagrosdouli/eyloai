import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/AuthContext.jsx', import.meta.url), 'utf8');

test('auth subscription is installed before the initial session result can update state', () => {
  assert.ok(source.indexOf('supabase.auth.onAuthStateChange') < source.indexOf('getSession().then'));
  assert.match(source, /if \(!mounted \|\| authEventVersion > 0\) return;/);
});

test('initial session lookup rejection exits loading with a mapped auth error', () => {
  assert.match(source, /getSession\(\)\.then\([\s\S]*?\.catch\(\(error\) => \{[\s\S]*?status: 'error'[\s\S]*?mapSupabaseError\(error\)/);
});
