import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

  const timedOut = mapSupabaseError(Object.assign(new Error('request timeout'), { name: 'AbortError' }));
  assert.equal(timedOut.code, AppErrorCode.NETWORK);
  assert.match(timedOut.message, /connection and retry/i);
});

test('expired session restoration keeps public sign-in routes available', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const context = await readFile(new URL('../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/lib/supabase/auth.js', import.meta.url), 'utf8');
  assert.match(app, /const AuthenticatedApp = \(\) => \{\s+return \(/);
  assert.doesNotMatch(app, /if \(isLoadingAuth\)[\s\S]*?<Routes>/);
  assert.match(app, /<Route path="\/login" element={<Login \/>} \/>/);
  assert.doesNotMatch(context, /from ['"]@\/lib\/supabase(?:Client|\/auth)['"]/);
  assert.match(context, /import\(['"]@\/lib\/supabase\/auth['"]\)/);
  assert.match(context, /withTimeout\(Promise\.all\(/);
  assert.match(auth, /getUsableSession\(\{ required: false, validate: true \}\)/);
  assert.match(app, /const PageNotFound = lazy\(\(\) => import\('\.\/lib\/PageNotFound'\)\)/);
  assert.match(app, /const PlanGate = lazy\(\(\) => import\('@\/components\/billing\/PlanGate'\)\)/);
});

test('protected routes expose a retry when session restoration fails', async () => {
  const route = await readFile(new URL('../src/components/ProtectedRoute.jsx', import.meta.url), 'utf8');
  const context = await readFile(new URL('../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  assert.match(route, /if \(status === 'idle'\) void initializeAuth\(\)/);
  assert.match(route, /status === 'error' \|\| status === 'configuration-error'/);
  assert.match(route, /onClick=\{refreshSession\}/);
  assert.match(route, /Sign in/);
  assert.match(context, /if \(state\.status !== 'authenticated'\) return initializeAuth\(\)/);
  assert.match(context, /withTimeout\(runtime\.authModule\.refreshSession\(\), SESSION_RESTORE_TIMEOUT_MS\)/);
});

test('provider rate-limit codes map to an actionable retry message', () => {
  const limited = mapSupabaseError({ code: 'over_request_rate_limit', status: 429 });
  assert.equal(limited.code, AppErrorCode.RATE_LIMITED);
  assert.match(limited.message, /wait and try again/i);
});

test('Supabase gateway fallback keeps the same bounded request timeout', async () => {
  const source = await readFile(new URL('../src/lib/supabaseClient.js', import.meta.url), 'utf8');
  assert.match(source, /return fetchWithTimeout\(directUrl, init\)/);
  assert.doesNotMatch(source, /return fetch\(directUrl, init\)/);
});
