import test from 'node:test';
import assert from 'node:assert/strict';

import { getSafeRedirect } from '../src/lib/auth/safeRedirect.ts';
import { AppErrorCode, mapSupabaseError } from '../src/lib/supabase/errors.js';

test('safe redirects accept known workspace and Labs destinations', () => {
  assert.equal(getSafeRedirect('/projects/abc?tab=evidence'), '/projects/abc?tab=evidence');
  assert.equal(getSafeRedirect('/projects?new=1'), '/projects?new=1');
  assert.equal(getSafeRedirect('/labs/scenario'), '/labs/scenario');
});

test('safe redirects reject external, protocol-relative and malformed destinations', () => {
  assert.equal(getSafeRedirect('https://example.com/phish'), '/home');
  assert.equal(getSafeRedirect('//example.com/phish'), '/home');
  assert.equal(getSafeRedirect('/projects\\..\\evil'), '/home');
  assert.equal(getSafeRedirect('/not-a-real-eylo-route'), '/home');
});

test('auth errors map sensitive provider messages to stable product errors', () => {
  const invalid = mapSupabaseError({ message: 'Invalid login credentials', status: 400 });
  assert.equal(invalid.code, AppErrorCode.INVALID_CREDENTIALS);
  assert.equal(invalid.message, 'The email or password is incorrect.');

  const limited = mapSupabaseError({ message: 'Too many requests', status: 429 });
  assert.equal(limited.code, AppErrorCode.RATE_LIMITED);
  assert.match(limited.message, /Too many attempts/);
});
