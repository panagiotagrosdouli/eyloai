import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../api/account-deletion-request.js';
import {
  deletionIntakeEnabled, validDeletionRequestBody, ACCOUNT_DELETION_CONFIRMATION,
  deletionSubmissionAction,
} from '../src/lib/account-deletion-request-policy.mjs';

const keys = [
  'EYLO_DELETION_REQUESTS_ENABLED', 'EYLO_DELETION_PREFLIGHT_ENABLED', 'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL',
];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const users = {
  'Bearer account-one': '11111111-1111-4111-8111-111111111111',
  'Bearer account-two': '22222222-2222-4222-8222-222222222222',
};

beforeEach(() => {
  for (const key of keys) delete process.env[key];
  process.env.EYLO_DELETION_REQUESTS_ENABLED = '1';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
  process.env.VITE_SUPABASE_ANON_KEY = 'public-test-key';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}
function request(method, token = 'Bearer account-one', body = null) {
  return { method, headers: { authorization: token }, body };
}

function mockDatabase({ denyWrites = false, invalidUser = false } = {}) {
  const rows = new Map();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const link = new URL(String(url));
    const headers = options.headers || {};
    const method = options.method || 'GET';
    calls.push({ path: link.pathname, method, headers, body: options.body });
    assert.equal(link.hostname, 'kbzjngpzxpniaumlupaa.supabase.co',
      'never use an unrelated Supabase project');
    if (link.pathname === '/auth/v1/user') {
      assert.equal(headers.apikey, 'public-test-key');
      const id = invalidUser ? 'arbitrary-identity' : users[headers.authorization];
      return new Response(JSON.stringify(id ? { id } : { message: 'unauthorized' }), {
        status: id ? 200 : 401, headers: { 'content-type': 'application/json' },
      });
    }
    assert.equal(headers.apikey, 'sb_secret_test_only');
    assert.equal(link.pathname, '/rest/v1/account_deletion_requests');
    if (method === 'GET') {
      assert.equal(link.searchParams.get('select'), 'status,requested_at');
      const owner = link.searchParams.get('user_id')?.replace(/^eq\./, '');
      const row = rows.get(owner);
      return new Response(JSON.stringify(row ? [row] : []), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (method === 'POST') {
      if (denyWrites) return new Response(JSON.stringify({ error: 'blocked' }), {
        status: 500, headers: { 'content-type': 'application/json' },
      });
      const { user_id: id } = JSON.parse(options.body);
      assert.equal(Object.keys(JSON.parse(options.body)).join(','), 'user_id');
      assert.ok(Object.values(users).includes(id));
      assert.match(headers.Prefer, /resolution=ignore-duplicates/);
      if (!rows.has(id)) rows.set(id, {
        status: 'pending_review', requested_at: '2026-11-07T00:00:00Z',
      });
      return new Response(null, { status: 201 });
    }
    throw new Error('Unexpected mutation ' + method);
  };
  return { rows, calls };
}

test('the feature defaults off and refuses wrong project, even when keys exist', async () => {
  delete process.env.EYLO_DELETION_REQUESTS_ENABLED;
  assert.equal(deletionIntakeEnabled(), false);
  process.env.EYLO_DELETION_REQUESTS_ENABLED = '1';
  process.env.VITE_SUPABASE_URL = 'https://umzrggayitzfgrrofjnw.supabase.co';
  assert.equal(deletionIntakeEnabled(), false);
  globalThis.fetch = async () => { throw new Error('Unverified environment must never contact DB'); };
  const res = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'DELETION_REQUESTS_UNAVAILABLE');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('anonymous, other HTTP methods and forged user IDs never reach service-role storage', async () => {
  const db = mockDatabase();
  const anon = response();
  await handler({ method: 'GET', headers: {} }, anon);
  assert.equal(anon.statusCode, 401);
  const wrongMethod = response();
  await handler(request('DELETE'), wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.Allow, 'GET, POST');
  const forged = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION, user_id: users['Bearer account-two'],
  }), forged);
  assert.equal(forged.statusCode, 400);
  assert.equal(db.calls.length, 0);
  assert.equal(validDeletionRequestBody({ confirmation: ACCOUNT_DELETION_CONFIRMATION }), true);
  assert.equal(validDeletionRequestBody({
    confirmation: ACCOUNT_DELETION_CONFIRMATION, user_id: 'forged',
  }), false);
});

test('a verified owner can submit once; repeats return the same pending request', async () => {
  const db = mockDatabase();
  const initial = response();
  await handler(request('GET'), initial);
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.body.request_status, 'not_requested');
  assert.equal(initial.body.preflight_available, false);
  const first = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), first);
  assert.equal(first.statusCode, 202);
  assert.equal(first.body.request_status, 'pending_review');
  assert.equal(first.body.preflight_available, false);
  assert.match(first.body.notice, /NOT been deleted/);
  assert.match(first.body.notice, /Stripe subscription remains unchanged/);
  const second = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), second);
  assert.equal(second.statusCode, 202);
  assert.equal(second.body.request_status, 'pending_review');
  assert.equal(db.calls.filter(x => x.method === 'POST').length, 1);
  assert.equal(db.rows.size, 1);
  assert.ok(db.calls.every(x => !['DELETE', 'PATCH'].includes(x.method)));
});

test('requests for two distinct users remain isolated, with server-derived identities', async () => {
  const db = mockDatabase();
  const a = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), a);
  const statusB = response();
  await handler(request('GET', 'Bearer account-two'), statusB);
  assert.equal(statusB.body.request_status, 'not_requested');
  const b = response();
  await handler(request('POST', 'Bearer account-two', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), b);
  assert.equal(db.rows.size, 2);
  const ownerParams = db.calls.filter(x => x.path.endsWith('/account_deletion_requests')
    && x.method === 'POST').map(x => JSON.parse(x.body).user_id);
  assert.deepEqual(ownerParams, [users['Bearer account-one'], users['Bearer account-two']]);
});

test('failed writes and invalid auth identities never claim an accepted request', async () => {
  mockDatabase({ denyWrites: true });
  const failure = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), failure);
  assert.equal(failure.statusCode, 502);
  assert.equal(failure.body.code, 'DELETION_REQUEST_UNVERIFIED');
  assert.equal(failure.body.request_status, undefined);
  mockDatabase({ invalidUser: true });
  const invalid = response();
  await handler(request('POST', 'Bearer account-one', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), invalid);
  assert.equal(invalid.statusCode, 502);
  assert.match(invalid.body.error, /No deletion has been performed/);
});

test('migration grants server-only access and contains no irreversible delete actions', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261107000000_account_deletion_request_intake.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter table public\.account_deletion_requests enable row level security/i);
  assert.match(sql, /revoke all on table public\.account_deletion_requests from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.account_deletion_requests to service_role/i);
  assert.match(sql, /user_id uuid primary key references auth\.users \(id\) on delete cascade/i);
  assert.doesNotMatch(sql, /delete\s+from\s+auth\.users/i);
  const endpoint = readFileSync(new URL('../api/account-deletion-request.js', import.meta.url), 'utf8');
  assert.doesNotMatch(endpoint, /auth\/v1\/admin\/users/);
  assert.doesNotMatch(endpoint, /stripe\.com/);
});

test('preflight availability requires the independent server-only switch', async () => {
  mockDatabase();
  process.env.EYLO_DELETION_PREFLIGHT_ENABLED = '1';
  const r = response();
  await handler(request('GET'), r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.preflight_available, true);
  delete process.env.EYLO_DELETION_REQUESTS_ENABLED;
  assert.equal(deletionIntakeEnabled(), false);
});

test('terminal requests cannot masquerade as newly accepted intake', async () => {
  const db = mockDatabase();
  for (const status of ['completed', 'declined']) {
    db.rows.set(users['Bearer account-one'], {
      status, requested_at: '2026-11-07T00:00:00Z',
    });
    const requestStatus = response();
    await handler(request('GET'), requestStatus);
    assert.equal(requestStatus.statusCode, 200);
    assert.equal(requestStatus.body.request_status, status, 'status remains visible for manual follow-up');
    const newSubmission = response();
    await handler(request('POST', 'Bearer account-one', {
      confirmation: ACCOUNT_DELETION_CONFIRMATION,
    }), newSubmission);
    assert.equal(newSubmission.statusCode, 409);
    assert.equal(newSubmission.body.code, 'DELETION_REQUEST_CLOSED');
    assert.equal(newSubmission.body.request_status, undefined);
    assert.match(newSubmission.body.notice, /NOT been deleted/);
  }
  assert.equal(db.calls.filter(call => call.method === 'POST').length, 0);
  assert.ok(db.calls.every(call => !['DELETE', 'PATCH'].includes(call.method)));
});

test('active review statuses remain safely idempotent and require no new writes', async () => {
  const db = mockDatabase();
  for (const status of ['pending_review', 'in_review', 'blocked_billing']) {
    db.rows.set(users['Bearer account-one'], {
      status, requested_at: '2026-11-07T00:00:00Z',
    });
    const res = response();
    await handler(request('POST', 'Bearer account-one', {
      confirmation: ACCOUNT_DELETION_CONFIRMATION,
    }), res);
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.request_status, status);
  }
  assert.equal(db.calls.filter(call => call.method === 'POST').length, 0);
});

test('only known request states are accepted in the lifecycle classifier', () => {
  assert.equal(deletionSubmissionAction(null), 'create');
  for (const state of ['pending_review', 'in_review', 'blocked_billing'])
    assert.equal(deletionSubmissionAction(state), 'existing');
  for (const state of ['completed', 'declined'])
    assert.equal(deletionSubmissionAction(state), 'closed');
  for (const unexpected of [undefined, '', 'deleted', 'in-progress', 0])
    assert.throws(() => deletionSubmissionAction(unexpected), /Unknown/);
});

test('revoked or expired Bearer credentials cannot query or create an owner request', async () => {
  const db = mockDatabase();
  const res = response();
  await handler(request('POST', 'Bearer expired-token', {
    confirmation: ACCOUNT_DELETION_CONFIRMATION,
  }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.request_status, undefined);
  assert.equal(db.calls.filter(call => call.path.startsWith('/rest/v1/')).length, 0);
});
