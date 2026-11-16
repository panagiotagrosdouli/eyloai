import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra-runs.js';

const owner = '00000000-0000-4000-8000-000000000001';
const runId = '20000000-0000-4000-8000-000000000001';
const keys = ['VITE_SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY','EYRA_DURABLE_RUNS_ENABLED'];
const previousEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
Object.assign(process.env, {
  VITE_SUPABASE_URL: 'https://eyra-runs-test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_SECRET_KEY: 'sb_secret_fixture',
  EYRA_DURABLE_RUNS_ENABLED: 'true',
});
after(() => {
  keys.forEach(key => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
});
function responseMock() {
  return {
    statusCode: 200, payload: null, headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}
function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

test('GET private run with owner predicate and private actions', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') {
      assert.equal(options.headers.authorization, 'Bearer valid-session');
      return reply({ id: owner });
    }
    assert.equal(options.headers.apikey, 'sb_secret_fixture');
    assert.equal(options.headers.authorization, undefined);
    assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
    if (u.pathname === '/rest/v1/eyra_agent_runs') {
      assert.equal(u.searchParams.get('id'), 'eq.' + runId);
      return reply([{ id: runId, status: 'completed', response_text: 'Done.' }]);
    }
    if (u.pathname === '/rest/v1/eyra_agent_actions') {
      assert.equal(u.searchParams.get('run_id'), 'eq.' + runId);
      return reply([{ call_id: 'one', status: 'succeeded' }]);
    }
    throw new Error('Unexpected path ' + u.pathname);
  };
  try {
    const res = responseMock();
    await handler({ method: 'GET', query: { id: runId },
      headers: { authorization: 'Bearer valid-session' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'private, no-store');
    assert.equal(res.payload.run.id, runId);
    assert.equal(res.payload.actions.length, 1);
  } finally { globalThis.fetch = previousFetch; }
});

test('cancellation is a running-state compare-and-swap with owner filter', async () => {
  const previousFetch = globalThis.fetch;
  let updated = 0;
  globalThis.fetch = async (url, options) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return reply({ id: owner });
    assert.equal(u.pathname, '/rest/v1/eyra_agent_runs');
    assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
    assert.equal(u.searchParams.get('status'), 'eq.running');
    assert.equal(options.method, 'PATCH');
    assert.equal(JSON.parse(options.body).status, 'cancelled');
    updated++;
    return reply(updated === 1 ? [{ id: runId }] : []);
  };
  try {
    for (const [expectedStatus, expectedCode] of [[200, undefined],[409, 'RUN_NOT_CANCELLABLE']]) {
      const res = responseMock();
      await handler({ method: 'POST', body: { id: runId, action: 'cancel' },
        headers: { authorization: 'Bearer valid-session' } }, res);
      assert.equal(res.statusCode, expectedStatus);
      if (expectedCode) assert.equal(res.payload.code, expectedCode);
      else assert.equal(res.payload.cancellation, 'best_effort');
    }
  } finally { globalThis.fetch = previousFetch; }
});

test('DELETE refuses running records and restricts deletion to owner', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return reply({ id: owner });
    assert.equal(options.method, 'DELETE');
    assert.equal(u.searchParams.get('status'), 'neq.running');
    assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
    return reply([]);
  };
  try {
    const res = responseMock();
    await handler({ method: 'DELETE', body: { id: runId },
      headers: { authorization: 'Bearer valid-session' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.code, 'RUN_NOT_DELETABLE');
  } finally { globalThis.fetch = previousFetch; }
});

test('malformed IDs, pagination and authentication fail before privileged DB operations', async () => {
  const previousFetch = globalThis.fetch;
  let authenticatedCalls = 0;
  globalThis.fetch = async (url) => {
    authenticatedCalls++;
    assert.equal(new URL(String(url)).pathname, '/auth/v1/user');
    return reply({ error: 'expired' }, 401);
  };
  try {
    for (const [request, status] of [
      [{ method: 'GET', query: { id: 'bad' }, headers: { authorization: 'Bearer valid-session' } }, 400],
      [{ method: 'GET', query: { limit: '100' }, headers: { authorization: 'Bearer valid-session' } }, 400],
      [{ method: 'POST', body: { id: runId, action: 'cancel' }, headers: {} }, 401],
      [{ method: 'GET', query: {}, headers: { authorization: 'Bearer expired-token' } }, 401],
    ]) {
      const res = responseMock();
      await handler(request, res);
      assert.equal(res.statusCode, status);
    }
    assert.equal(authenticatedCalls, 1);
  } finally { globalThis.fetch = previousFetch; }
});

test('feature disabled reports unavailable without making network calls', async () => {
  const previous = process.env.EYRA_DURABLE_RUNS_ENABLED;
  delete process.env.EYRA_DURABLE_RUNS_ENABLED;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Should not contact upstream'); };
  try {
    const res = responseMock();
    await handler({ method: 'GET', query: {}, headers: { authorization: 'Bearer token' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.code, 'AGENT_LEDGER_UNAVAILABLE');
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.EYRA_DURABLE_RUNS_ENABLED;
    else process.env.EYRA_DURABLE_RUNS_ENABLED = previous;
  }
});

test('stale running agent run is marked for manual review without replaying tools', async () => {
  const previousFetch = globalThis.fetch;
  const staleTime = new Date(Date.now() - 40 * 60 * 1000).toISOString();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    calls.push({ method: options.method || 'GET', pathname: u.pathname });
    if (u.pathname === '/auth/v1/user') return reply({ id: owner });
    assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
    if (u.pathname === '/rest/v1/eyra_agent_runs') {
      if (options.method === 'GET') {
        assert.equal(u.searchParams.get('id'), 'eq.' + runId);
        return reply([{ id: runId, status: 'running', updated_at: staleTime }]);
      }
      assert.equal(options.method, 'PATCH');
      assert.equal(u.searchParams.get('status'), 'eq.running');
      assert.equal(u.searchParams.get('updated_at'), 'eq.' + staleTime);
      assert.equal(JSON.parse(options.body).status, 'needs_review');
      return reply([{ id: runId, status: 'needs_review' }]);
    }
    if (u.pathname === '/rest/v1/eyra_agent_actions') {
      assert.equal(options.method, 'PATCH');
      assert.equal(u.searchParams.get('run_id'), 'eq.' + runId);
      assert.equal(u.searchParams.get('status'), 'eq.started');
      const body = JSON.parse(options.body);
      assert.equal(body.status, 'needs_review');
      assert.equal(body.error_code, 'STALE_ACTION_OUTCOME_UNVERIFIED');
      return reply([{ id: 'action-1', status: 'needs_review' }]);
    }
    throw new Error('Unexpected URL ' + u);
  };
  try {
    const res = responseMock();
    await handler({ method: 'POST', body: { id: runId, action: 'review_stale' },
      headers: { authorization: 'Bearer valid-session' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.status, 'needs_review');
    assert.equal(res.payload.recovery, 'manual_inspection_only');
    assert.deepEqual(calls.map(x => x.pathname), [
      '/auth/v1/user',
      '/rest/v1/eyra_agent_runs',
      '/rest/v1/eyra_agent_runs',
      '/rest/v1/eyra_agent_actions',
    ]);
    assert.ok(!calls.some(x => x.pathname.includes('/projects') || x.pathname.includes('/openai')));
  } finally { globalThis.fetch = previousFetch; }
});

test('fresh, terminal and missing agent runs cannot be marked stale', async () => {
  const previousFetch = globalThis.fetch;
  let item = { id: runId, status: 'running', updated_at: new Date().toISOString() };
  let mutations = 0;
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return reply({ id: owner });
    if (options.method === 'PATCH') mutations++;
    assert.equal(u.pathname, '/rest/v1/eyra_agent_runs');
    assert.equal(options.method, 'GET');
    return reply(item ? [item] : []);
  };
  try {
    const request = { method: 'POST', body: { id: runId, action: 'review_stale' },
      headers: { authorization: 'Bearer valid-session' } };
    for (const [row, status, code] of [
      [{ id: runId, status: 'running', updated_at: new Date().toISOString() }, 409, 'RUN_NOT_STALE'],
      [{ id: runId, status: 'completed', updated_at: new Date(Date.now() - 3600000).toISOString() }, 409, 'RUN_NOT_STALE'],
      [null, 404, 'RUN_NOT_FOUND'],
      [{ id: runId, status: 'running', updated_at: 'not-a-timestamp' }, 409, 'RUN_NOT_STALE'],
    ]) {
      item = row;
      const res = responseMock();
      await handler(request, res);
      assert.equal(res.statusCode, status);
      assert.equal(res.payload.code, code);
    }
    assert.equal(mutations, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('stale recovery refuses changed run and never touches tool records', async () => {
  const previousFetch = globalThis.fetch;
  let actionUpdates = 0;
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return reply({ id: owner });
    if (u.pathname === '/rest/v1/eyra_agent_runs') {
      if (options.method === 'GET') return reply([{
        id: runId, status: 'running', updated_at: new Date(Date.now() - 3600000).toISOString(),
      }]);
      assert.equal(options.method, 'PATCH');
      return reply([]);
    }
    if (u.pathname === '/rest/v1/eyra_agent_actions') actionUpdates++;
    throw new Error('Unexpected URL');
  };
  try {
    const res = responseMock();
    await handler({ method: 'POST', body: { id: runId, action: 'review_stale' },
      headers: { authorization: 'Bearer valid-session' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.code, 'RUN_CHANGED');
    assert.equal(actionUpdates, 0);
  } finally { globalThis.fetch = previousFetch; }
});
