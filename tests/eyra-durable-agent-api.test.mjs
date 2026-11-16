import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';
import { requestFingerprint } from '../server/eyra-run-ledger.mjs';

const owner = '00000000-0000-4000-8000-000000000001';
const requestId = '10000000-0000-4000-8000-000000000011';
const runId = '20000000-0000-4000-8000-000000000011';
const actionId = '30000000-0000-4000-8000-000000000011';
const envKeys = ['VITE_SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY','EYRA_DURABLE_RUNS_ENABLED','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID','STRIPE_FOUNDER_PRICE_ID',
  'EYLO_ENVIRONMENT','EYLO_STAGING_SUPABASE_REF','EYLO_STAGING_CONFIRMED_REF'];
const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
Object.assign(process.env, {
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  OPENAI_API_KEY: 'sk-test-placeholder',
  EYRA_DURABLE_RUNS_ENABLED: 'true',
  EYLO_ENVIRONMENT: 'staging',
  EYLO_STAGING_SUPABASE_REF: 'abcdefghijklmnopqrst',
  EYLO_STAGING_CONFIRMED_REF: 'abcdefghijklmnopqrst',
});
for (const key of envKeys.slice(5)) delete process.env[key];
after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function resMock() {
  return {
    statusCode: 200, payload: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}
function ok(data, status = 200) { return new Response(JSON.stringify(data), { status }); }
const prompt = 'List my projects.';
const body = { prompt, enable_project_tools: true, run_request_id: requestId };

test('durable agent rejects invalid run UUID before reserving quota', async () => {
  const prev = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    assert.equal(new URL(String(url)).pathname, '/auth/v1/user');
    return ok({ id: owner });
  };
  try {
    const res = resMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { ...body, run_request_id: 'not-a-uuid' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.code, 'INVALID_RUN_REQUEST_ID');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = prev; }
});

test('duplicate durable run is not automatically replayed, not charged and never reaches model', async () => {
  const prev = globalThis.fetch;
  let modelCalls = 0, refunded = 0;
  const hash = requestFingerprint({
    prompt, latest_user_request: null, resource_context: null, tools: true,
    schema: null, write_confirmed: false,
  });
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return ok({ id: owner });
    if (u.pathname === '/rest/v1/rpc/reserve_eyra_usage') return ok([{ allowed: true, used: 1 }]);
    if (u.pathname === '/rest/v1/rpc/release_eyra_usage') { refunded++; return ok({ released: true }); }
    if (u.pathname === '/rest/v1/eyra_agent_runs') {
      assert.equal(options.headers.apikey, 'sb_secret_test');
      if (options.method === 'POST') return ok([]);
      assert.equal(options.method, 'GET');
      assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
      return ok([{ id: runId, user_id: owner, request_id: requestId,
        request_hash: hash, status: 'needs_review' }]);
    }
    if (u.hostname === 'api.openai.com') modelCalls++;
    throw new Error('Unexpected network call ' + u.pathname);
  };
  try {
    const res = resMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' }, body }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.payload.code, 'RUN_ALREADY_EXISTS');
    assert.equal(res.payload.run_id, runId);
    assert.equal(res.payload.status, 'needs_review');
    assert.equal(refunded, 1);
    assert.equal(modelCalls, 0);
  } finally { globalThis.fetch = prev; }
});

test('new durable run records once-only project.list action and verified terminal state', async () => {
  const prev = globalThis.fetch;
  let modelCalls = 0, actionReserves = 0, actionCompletes = 0, runCompletes = 0;
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return ok({ id: owner });
    if (u.pathname === '/rest/v1/rpc/reserve_eyra_usage') return ok([{ allowed: true, used: 1 }]);
    if (u.pathname === '/rest/v1/eyra_agent_runs') {
      assert.equal(options.headers.apikey, 'sb_secret_test');
      if (options.method === 'POST') return ok([{ id: runId, user_id: owner, request_id: requestId }]);
      if (options.method === 'GET') {
        assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
        return ok([{ id: runId, status: 'running' }]);
      }
      runCompletes++;
      assert.equal(options.method, 'PATCH');
      assert.equal(JSON.parse(options.body).status, 'completed');
      assert.equal(u.searchParams.get('status'), 'eq.running');
      return ok([{ id: runId, status: 'completed' }]);
    }
    if (u.pathname === '/rest/v1/eyra_agent_actions') {
      assert.equal(options.headers.apikey, 'sb_secret_test');
      if (options.method === 'POST') {
        actionReserves++;
        assert.equal(JSON.parse(options.body).tool_name, 'project.list');
        return ok([{ id: actionId, user_id: owner, run_id: runId,
          call_id: 'list-once', status: 'started' }]);
      }
      actionCompletes++;
      assert.equal(options.method, 'PATCH');
      assert.equal(JSON.parse(options.body).status, 'succeeded');
      return ok([{ id: actionId, status: 'succeeded' }]);
    }
    if (u.pathname === '/rest/v1/projects') {
      assert.equal(options.headers.authorization, 'Bearer user-access-token');
      assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
      return ok([]);
    }
    if (u.hostname === 'api.openai.com') {
      modelCalls++;
      return ok(modelCalls === 1
        ? { id: 'step1', status: 'completed', output: [{
          type: 'function_call', name: 'project.list', call_id: 'list-once', arguments: '{}',
        }] }
        : { id: 'step2', status: 'completed',
          output: [{ content: [{ type: 'output_text', text: 'You have zero projects.' }] }] });
    }
    throw new Error('Unexpected network ' + u.pathname);
  };
  try {
    const res = resMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' }, body }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.run_id, runId);
    assert.equal(res.payload.run_status, 'completed');
    assert.equal(res.payload.actions[0].status, 'succeeded');
    assert.equal(actionReserves, 1);
    assert.equal(actionCompletes, 1);
    assert.equal(runCompletes, 1);
    assert.equal(modelCalls, 2);
  } finally { globalThis.fetch = prev; }
});

test('write whose response is lost is marked for review rather than claimed complete', async () => {
  const prev = globalThis.fetch;
  let modelCalls = 0, projectWrites = 0, terminalStatus = null, actionStatus = null;
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/auth/v1/user') return ok({ id: owner });
    if (u.pathname === '/rest/v1/rpc/reserve_eyra_usage') return ok([{ allowed: true, used: 1 }]);
    if (u.pathname === '/rest/v1/eyra_agent_runs') {
      if (options.method === 'POST') return ok([{ id: runId, user_id: owner, request_id: requestId }]);
      if (options.method === 'GET') return ok([{ id: runId, status: 'running' }]);
      terminalStatus = JSON.parse(options.body).status;
      return ok([{ id: runId, status: terminalStatus }]);
    }
    if (u.pathname === '/rest/v1/eyra_agent_actions') {
      if (options.method === 'POST') return ok([{
        id: actionId, user_id: owner, run_id: runId, call_id: 'write-once', status: 'started',
      }]);
      actionStatus = JSON.parse(options.body).status;
      return ok([{ id: actionId, status: actionStatus }]);
    }
    if (u.pathname === '/rest/v1/projects' && options.method === 'POST') {
      projectWrites++;
      // Simulate a commit that succeeded at the database but whose HTTP reply
      // was lost. The backend cannot prove whether the write committed.
      throw new Error('Connection dropped after insert');
    }
    if (u.hostname === 'api.openai.com') {
      modelCalls++;
      return ok(modelCalls === 1 ? {
        id: 'write_attempt', status: 'completed', output: [{
          type: 'function_call', call_id: 'write-once', name: 'project.create',
          arguments: JSON.stringify({
            title: 'Graph research', description: '', goal: '', milestones: '', tasks: '',
          }),
        }],
      } : { id: 'final_answer', status: 'completed',
        output: [{ content: [{ type: 'output_text', text: 'Review the project workspace before retrying.' }] }] });
    }
    throw new Error('Unexpected network ' + u.pathname);
  };
  try {
    const res = resMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { ...body, prompt: 'Create a project about graph research.', write_confirmed: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(projectWrites, 1);
    assert.equal(res.payload.run_status, 'needs_review');
    assert.equal(res.payload.actions[0].status, 'needs_review');
    assert.equal(terminalStatus, 'needs_review');
    assert.equal(actionStatus, 'needs_review');
  } finally { globalThis.fetch = prev; }
});
