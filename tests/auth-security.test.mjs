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
  for (const path of [
    '/home?tab=projects', '/workspace/careers', '/search?q=climate',
    '/research-gaps', '/knowledge-graph', '/grant-builder',
    '/pitchdeck', '/institution',
  ]) assert.equal(getSafeRedirect(path), path);
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


test('structured Supabase Auth codes produce safe, actionable errors independent of message text', () => {
  const cases = [
    ['invalid_credentials', AppErrorCode.INVALID_CREDENTIALS],
    ['email_not_confirmed', AppErrorCode.EMAIL_NOT_CONFIRMED],
    ['user_already_exists', AppErrorCode.USER_ALREADY_REGISTERED],
    ['email_exists', AppErrorCode.USER_ALREADY_REGISTERED],
    ['weak_password', AppErrorCode.WEAK_PASSWORD],
    ['over_email_send_rate_limit', AppErrorCode.RATE_LIMITED],
    ['email_address_invalid', AppErrorCode.INVALID_EMAIL],
    ['email_address_not_authorized', AppErrorCode.EMAIL_SEND_FAILED],
    ['email_provider_disabled', AppErrorCode.SIGNUP_DISABLED],
    ['signup_disabled', AppErrorCode.SIGNUP_DISABLED],
    ['otp_expired', AppErrorCode.EXPIRED_RECOVERY_LINK],
    ['flow_state_expired', AppErrorCode.EXPIRED_RECOVERY_LINK],
    ['flow_state_not_found', AppErrorCode.EXPIRED_RECOVERY_LINK],
  ];
  for (const [code, expected] of cases) {
    const error = mapSupabaseError({ code, status: 400, message: 'Provider secret detail opaque-123' });
    assert.equal(error.code, expected, code);
    assert.doesNotMatch(error.message, /opaque-123|provider secret detail/i);
  }

  // Throttling must not be displayed as bad credentials or a delivered email.
  const throttled = mapSupabaseError({ code: 'invalid_credentials', status: 429 });
  assert.equal(throttled.code, AppErrorCode.RATE_LIMITED);
  const outage = mapSupabaseError({ code: 'invalid_credentials', status: 503 });
  assert.equal(outage.code, AppErrorCode.SERVICE_UNAVAILABLE);
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


test('signed-in public entry routes redirect into the authenticated workspace', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
  assert.match(app, /status === 'authenticated'\) return <Navigate to=\{\{ pathname: workspacePath, search \}\} replace \/>/);
  assert.match(app, /<Route path="\/" element=\{<PublicEntry><Landing \/><\/PublicEntry>\} \/>/);
  assert.match(app, /<Route path="\/discover" element=\{<PublicEntry workspacePath="\/search">/);
  // Independent EYLO Academics is available with or without a logged-in
  // workspace; only workspace-specific routes are protected/redirected.
  assert.match(app, /<Route path="\/academics" element=\{<PublicResearchers \/>\}/);
  assert.match(app, /<Route path="\/find-researchers" element=\{<PublicResearchers \/>\}/);
  assert.match(app, /<Route path="\/careers" element=\{<PublicEntry workspacePath="\/workspace\/careers">/);
  assert.match(app, /<Route path="\/workspace\/careers" element=\{<Careers \/>\} \/>/);
  assert.match(app, /<Route path="\/careers" element=\{<PublicEntry workspacePath="\/workspace\/careers"><PublicCareers \/><\/PublicEntry>\} \/>/);
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


test('authentication preserves current product and privacy destinations, including section anchors', () => {
 for(const path of ['/account-deletion','/account-deletion#receipt','/tools/forms','/collaboration/peer-review','/automations','/calendar','/notes?focus=exact-note','/files','/documents/new','/life/goals','/study','/learn','/quiz-generator','/time-tracker','/offline']) assert.equal(getSafeRedirect(path),path);
 for(const path of ['/tools-evil','//tools.evil.example','/account-deletion-evil','/tools/../../login','https://evil.example/tools']) assert.equal(getSafeRedirect(path),'/home');
});

test('password reset handles rejected authentication requests with a retryable error', async () => {
  const page = await readFile(new URL('../src/pages/ResetPassword.jsx', import.meta.url), 'utf8');
  assert.match(page, /try\s*\{[\s\S]*?await updatePassword\(password\)/);
  assert.match(page, /catch\s*\{\s*setFormError\(["']The account service could not be reached/);
  assert.match(page, /result\?\.error\?\.message\s*\|\|/);
});
