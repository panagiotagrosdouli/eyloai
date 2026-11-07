import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import preflight from '../api/account-deletion-preflight.js';
import {
  DELETION_OWNER_TABLES, exactPostgrestCount, deletionReviewReport, billingLinkReview,
} from '../src/lib/account-deletion-preflight.mjs';
import { deletionPreflightEnabled } from '../src/lib/account-deletion-request-policy.mjs';

const ENV_KEYS = [
  'EYLO_DELETION_REQUESTS_ENABLED', 'EYLO_DELETION_PREFLIGHT_ENABLED',
  'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
];
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
const ORIGINAL_FETCH = globalThis.fetch;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.EYLO_DELETION_REQUESTS_ENABLED = '1';
  process.env.EYLO_DELETION_PREFLIGHT_ENABLED = '1';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
  process.env.VITE_SUPABASE_ANON_KEY = 'public-test-key';
});
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

function request(auth = 'Bearer account-a') {
  return { method: 'GET', headers: { authorization: auth }, query: { user_id: B }, body: { user_id: B } };
}
function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(v) { this.body = v; return this; },
  };
}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});

function mockStorage({
  pending = true, missingTable = null, missingCount = null,
  user = A, billingFailed = false, billingRows = [{
    plan: 'pro',
    subscription_status: 'active',
    stripe_customer_id: 'cus_PRIVATE_IDENTIFIER',
    stripe_subscription_id: 'sub_PRIVATE_IDENTIFIER',
  }],
} = {}) {
  const calls = [];
  const counts = Object.fromEntries(DELETION_OWNER_TABLES.map((table, i) => [table, i % 3]));
  globalThis.fetch = async (target, options = {}) => {
    const url = new URL(String(target));
    const method = options.method || 'GET';
    calls.push({ url, method, options });
    assert.equal(url.hostname, 'kbzjngpzxpniaumlupaa.supabase.co');
    assert.equal(options.cache, 'no-store');
    if (url.pathname === '/auth/v1/user') {
      assert.equal(options.headers.apikey, 'public-test-key');
      const id = options.headers.authorization === 'Bearer account-a' ? A
        : options.headers.authorization === 'Bearer account-b' ? B : null;
      return id ? jsonResponse({ id }) : jsonResponse({ message: 'invalid token' }, 401);
    }
    assert.equal(options.headers.apikey, 'sb_secret_test_only');
    if (url.pathname === '/rest/v1/account_deletion_requests') {
      assert.equal(method, 'GET');
      assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
      return jsonResponse(pending ? [{ status: 'pending_review', requested_at: '2026-11-07T00:00:00Z' }] : []);
    }
    if (url.pathname === '/rest/v1/billing_entitlements' && method === 'GET') {
      assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
      assert.equal(url.searchParams.get('select'), 'plan,subscription_status,stripe_customer_id,stripe_subscription_id');
      assert.equal(url.searchParams.get('limit'), '1');
      return billingFailed ? jsonResponse({ message: 'billing unavailable' }, 503)
        : jsonResponse(billingRows);
    }
    const table = url.pathname.split('/').at(-1);
    assert.ok(DELETION_OWNER_TABLES.includes(table));
    assert.equal(method, 'HEAD');
    assert.equal(options.headers.Prefer, 'count=exact');
    assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
    assert.equal(url.searchParams.get('select'), 'user_id');
    assert.equal(url.searchParams.get('limit'), '1');
    if (table === missingTable) return new Response(null, { status: 404 });
    const headers = table === missingCount ? {} : { 'content-range': `*/${counts[table]}` };
    return new Response(null, { status: 200, headers });
  };
  return { calls, counts };
}

test('read-only preflight is separately disabled by default and mismatched Supabase blocks it', async () => {
  delete process.env.EYLO_DELETION_PREFLIGHT_ENABLED;
  assert.equal(deletionPreflightEnabled(), false);
  globalThis.fetch = async () => { throw Error('Disabled preflight must never contact data store'); };
  const r = response();
  await preflight(request(), r);
  assert.equal(r.statusCode, 503);
  assert.equal(r.body.code, 'DELETION_PREFLIGHT_UNAVAILABLE');
  assert.equal(r.headers['Cache-Control'], 'private, no-store');
  process.env.EYLO_DELETION_PREFLIGHT_ENABLED = '1';
  process.env.VITE_SUPABASE_URL = 'https://umzrggayitzfgrrofjnw.supabase.co';
  const mismatched = response();
  await preflight(request(), mismatched);
  assert.equal(mismatched.statusCode, 503);
});

test('preflight rejects unauthenticated users before any count query', async () => {
  const db = mockStorage();
  for (const auth of [null, 'Bearer ', 'untrusted']) {
    const r = response();
    await preflight(request(auth), r);
    assert.equal(r.statusCode, 401);
  }
  assert.equal(db.calls.length, 0);
  const r = response();
  await preflight({ method: 'POST', headers: { authorization: 'Bearer account-a' } }, r);
  assert.equal(r.statusCode, 405);
  assert.equal(r.headers.Allow, 'GET');
});

test('preflight is available only after a pending owner request, not on a mere JWT', async () => {
  const db = mockStorage({ pending: false });
  const r = response();
  await preflight(request(), r);
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.code, 'NO_OPEN_DELETION_REQUEST');
  assert.equal(db.calls.length, 2);
});

test("counts exactly the verified owner\'s rows, never uses attacker-supplied ID", async () => {
  const db = mockStorage();
  const r = response();
  await preflight(request(), r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.stage, 'read_only_inventory');
  assert.equal(r.body.account_deleted, false);
  assert.equal(r.body.deletion_authorized, false);
  assert.equal(r.body.request_status, 'pending_review');
  assert.deepEqual(r.body.verified_user_row_counts, db.counts);
  assert.equal(r.body.billing_review.local_paid_plan_recorded, true);
  assert.equal(r.body.billing_review.stripe_subscription_link_recorded, true);
  assert.equal(r.body.billing_review.requires_independent_stripe_review, true);
  assert.equal(JSON.stringify(r.body).includes('cus_PRIVATE_IDENTIFIER'), false);
  assert.equal(JSON.stringify(r.body).includes('sub_PRIVATE_IDENTIFIER'), false);
  assert.ok(r.body.unresolved_checks.includes('supabase_storage_objects'));
  assert.ok(r.body.unresolved_checks.includes('external_stripe_subscription_and_payment_retention'));
  assert.ok(db.calls.every(call => ['GET', 'HEAD'].includes(call.method)));
  assert.equal(db.calls.filter(call => call.method === 'HEAD').length, DELETION_OWNER_TABLES.length);
  assert.ok(db.calls.filter(call => call.url.pathname.startsWith('/rest/v1/'))
    .every(call => call.url.searchParams.get('user_id') === `eq.${A}`));
  assert.equal(JSON.stringify(r.body).includes(A), false, 'do not return owner identity or private records');
});

test('second verified owner cannot inspect first owner, even with forged query/body', async () => {
  const db = mockStorage({ user: B });
  const r = response();
  await preflight(request('Bearer account-b'), r);
  assert.equal(r.statusCode, 200);
  assert.equal(db.calls.filter(c => c.url.pathname.startsWith('/rest/v1/'))
    .every(c => c.url.searchParams.get('user_id') === `eq.${B}`), true);
});

test('missing table or missing count header is fail-closed, never misreported as zero', async () => {
  for (const mode of ['missingTable', 'missingCount']) {
    const db = mockStorage({ [mode]: 'ideas' });
    const r = response();
    await preflight(request(), r);
    assert.equal(r.statusCode, 502);
    assert.equal(r.body.code, 'DELETION_INVENTORY_UNVERIFIED');
    assert.equal(r.body.verified_user_row_counts, undefined);
    assert.equal(db.calls.filter(c => c.method !== 'GET' && c.method !== 'HEAD').length, 0);
  }
});

test('exact counts reject unknown and unsafe PostgREST headers', () => {
  const fake = value => ({ ok: true, headers: new Headers(value === null ? {} : { 'content-range': value }) });
  assert.equal(exactPostgrestCount(fake('*/0')), 0);
  assert.equal(exactPostgrestCount(fake('0-0/1')), 1);
  assert.equal(exactPostgrestCount(fake('0-0/400')), 400);
  for (const range of [null, '0-0/*', '100', '*/-1', '0-0/9999999999999999999999999999']) {
    assert.throws(() => exactPostgrestCount(fake(range)), /count|range/i);
  }
});

test('a complete inventory NEVER claims erasure is approved', () => {
  const counts = Object.fromEntries(DELETION_OWNER_TABLES.map(key => [key, 0]));
  const bill = billingLinkReview([]);
  const result = deletionReviewReport(counts, 'pending_review', bill);
  assert.equal(result.deletion_authorized, false);
  assert.equal(result.account_deleted, false);
  assert.equal(result.unresolved_checks.length >= 5, true);
  const truncated = { ...counts };
  delete truncated.institution_memberships;
  assert.throws(() => deletionReviewReport(truncated, 'pending_review'), /Incomplete/);
});

test('local missing billing record still forces independent Stripe review', async () => {
  mockStorage({ billingRows: [] });
  const r = response();
  await preflight(request(), r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.billing_review.local_record_found, false);
  assert.equal(r.body.billing_review.requires_independent_stripe_review, true);
  assert.match(r.body.billing_review.warning, /does not prove/);
});

test('failed or malformed local billing reads refuse the entire preflight', async () => {
  for (const mode of [
    { billingFailed: true },
    { billingRows: [{ plan: 'pro', subscription_status: 'active' }, { plan: 'free', subscription_status: 'active' }] },
    { billingRows: [{ plan: 'impossible', subscription_status: 'active' }] },
    { billingRows: [{ plan: 'pro', subscription_status: null }] },
  ]) {
    const db = mockStorage(mode);
    const r = response();
    await preflight(request(), r);
    assert.equal(r.statusCode, 502);
    assert.equal(r.body.code, 'DELETION_INVENTORY_UNVERIFIED');
    assert.equal(r.body.billing_review, undefined);
    assert.ok(db.calls.every(c => ['GET', 'HEAD'].includes(c.method)));
  }
});

test('billing risk summary never exposes payment IDs or authorizes deletion', () => {
  const summary = billingLinkReview([{
    plan: 'founder',
    subscription_status: 'past_due',
    stripe_customer_id: 'cus_very_sensitive',
    stripe_subscription_id: 'sub_very_sensitive',
  }]);
  assert.equal(summary.local_paid_plan_recorded, true);
  assert.equal(summary.stripe_subscription_link_recorded, true);
  assert.equal(summary.requires_independent_stripe_review, true);
  assert.equal(JSON.stringify(summary).includes('cus_very_sensitive'), false);
  assert.equal(JSON.stringify(summary).includes('sub_very_sensitive'), false);
  assert.throws(() => deletionReviewReport({}, 'pending_review', null), /Incomplete/);
});
