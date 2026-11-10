import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getSafeRedirect } from '../src/lib/auth/safeRedirect.ts';
import { AppErrorCode, mapSupabaseError } from '../src/lib/supabase/errors.js';

test('safe redirects accept known workspace and Labs destinations', () => {
  assert.equal(getSafeRedirect('/projects/abc?tab=evidence'), '/projects/abc?tab=evidence');
  assert.equal(getSafeRedirect('/projects?new=1'), '/projects?new=1');
  assert.equal(getSafeRedirect('/home'), '/home');
  assert.equal(getSafeRedirect('/labs/scenario'), '/labs/scenario');
});

test('safe redirects reject external, protocol-relative and malformed destinations', () => {
  assert.equal(getSafeRedirect('https://example.com/phish'), '/home');
  assert.equal(getSafeRedirect('/'), '/home');
  assert.equal(getSafeRedirect('/?campaign=research'), '/home');
  assert.equal(getSafeRedirect('/#about'), '/home');
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

test('Supabase is never silently routed through a hard-coded proxy', async () => {
  const source = await readFile(new URL('../src/lib/supabaseClient.js', import.meta.url), 'utf8');
  assert.match(source, /const supabaseUrl = environment\.values\.VITE_SUPABASE_URL/);
  assert.match(source, /global: \{ fetch: fetchWithTimeout \}/);
  assert.doesNotMatch(source, /gatewayProjectUrl|gatewayFetch|allowGateway/);
});


test('signed-in public entry routes redirect into the authenticated workspace', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
  assert.match(app, /status === 'authenticated'\) return <Navigate to=\{workspacePath\} replace \/>/);
  assert.match(app, /<Route path="\/" element=\{<PublicEntry><Landing \/><\/PublicEntry>\} \/>/);
  assert.match(app, /<Route path="\/discover" element=\{<PublicEntry workspacePath="\/search">/);
  assert.match(app, /<Route path="\/find-researchers" element=\{<PublicEntry workspacePath="\/researchers">/);
  assert.match(app, /<Route path="\/careers" element=\{<PublicEntry workspacePath="\/workspace\/careers">/);
  assert.match(app, /<Route path="\/workspace\/careers" element=\{<PublicCareers \/>\} \/>/);
  assert.match(layout, /label: 'Careers', path: '\/workspace\/careers'/);
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>/);
});

test('authentication distinguishes service configuration, network, and email delivery failures', () => {
  const configuration = mapSupabaseError(Object.assign(new Error('Authentication service is not configured.'), {
    code: 'SUPABASE_CONFIGURATION_ERROR',
  }));
  assert.equal(configuration.code, AppErrorCode.CONFIGURATION);

  const network = mapSupabaseError(new TypeError('Failed to fetch'));
  assert.equal(network.code, AppErrorCode.NETWORK);

  const delivery = mapSupabaseError({ message: 'Error sending confirmation email', status: 400 });
  assert.equal(delivery.code, AppErrorCode.EMAIL_SEND_FAILED);
});
