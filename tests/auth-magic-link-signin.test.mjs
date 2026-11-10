import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('magic link login does not implicitly register a new user', () => {
  const source = readFileSync(new URL('../src/lib/supabase/auth.js', import.meta.url), 'utf8');
  const operation = source.slice(source.indexOf('export async function signInWithMagicLink'), source.indexOf('export async function signOut'));
  assert.match(operation, /shouldCreateUser: false/);
  assert.doesNotMatch(operation, /shouldCreateUser: true/);
});
