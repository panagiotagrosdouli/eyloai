import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra-approve.js';
import { sealEyraWriteProposal } from '../server/eyra-field-approval.mjs';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const runId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const request = 'Create a project for a reproducibility audit';
const proposal = { tool: 'project.create', fields: {
  title: 'Reviewed audit', description: 'Exact approved field', goal: 'Reproducibility',
  milestones: '', tasks: '',
} };
const keys = ['EYRA_FIELD_APPROVAL_ENABLED', 'EYRA_DURABLE_RUNS_ENABLED', 'EYRA_WRITE_APPROVAL_SECRET',
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID'];
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
after(() => { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
function enable() {
  process.env.EYRA_FIELD_APPROVAL_ENABLED = 'true';
  process.env.EYRA_DURABLE_RUNS_ENABLED = 'true';
  process.env.EYRA_WRITE_APPROVAL_SECRET = 'fixture-only-key-longer-than-32-characters';
  process.env.VITE_SUPABASE_URL = 'https://approved-fixture.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_fixture';
  for (const k of keys.slice(6)) delete process.env[k];
}
function responseMock() { return {
  statusCode: 200, headers: {}, payload: null,
  status(code) { this.statusCode = code; return this; },
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
  json(payload) { this.payload = payload; return this; },
}; }
const respond = rows => new Response(JSON.stringify(rows), { status: 200 });
function mockBackend(events, replay = false) {
  return async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = parsed.pathname;
    const method = options.method || 'GET';
    events.push({ path, method, body: options.body ? JSON.parse(options.body) : null });
    if (path === '/auth/v1/user') return respond({ id: owner });
    if (path === '/rest/v1/eyra_agent_runs' && method === 'POST') {
      assert.equal(options.headers.prefer, 'resolution=ignore-duplicates,return=representation');
      assert.equal(JSON.parse(options.body).user_id, owner);
      return respond(replay ? [] : [{ id: runId, user_id: owner, request_id: JSON.parse(options.body).request_id }]);
    }
    if (path === '/rest/v1/eyra_agent_runs' && method === 'GET') {
      assert.equal(parsed.searchParams.get('user_id'), 'eq.' + owner);
      return respond([{ id: runId, user_id: owner, request_id: events.find(e=>e.path==='/rest/v1/eyra_agent_runs'&&e.method==='POST').body.request_id, request_hash: events.find(e=>e.path==='/rest/v1/eyra_agent_runs'&&e.method==='POST').body.request_hash, status:'completed' }]);
    }
    if (path === '/rest/v1/eyra_agent_actions' && method === 'POST') {
      assert.equal(JSON.parse(options.body).user_id, owner);
      return respond([{ id: actionId, run_id: runId, user_id: owner, call_id: 'exact_fields_approved', status: 'started' }]);
    }
    if (path === '/rest/v1/eyra_agent_actions' && method === 'PATCH') {
      assert.equal(JSON.parse(options.body).status, 'succeeded');
      return respond([{ id: actionId, status: 'succeeded' }]);
    }
    if (path === '/rest/v1/eyra_agent_runs' && method === 'PATCH') {
      assert.equal(JSON.parse(options.body).status, 'completed');
      return respond([{ id: runId, status: 'completed' }]);
    }
    if (path === '/rest/v1/projects' && method === 'POST') {
      const row = JSON.parse(options.body);
      assert.equal(row.user_id, owner);
      assert.deepEqual(row.data, { ...proposal.fields, status: 'planning' });
      return respond([{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', data: row.data }]);
    }
    throw new Error('Unexpected service call: ' + method + ' ' + path);
  };
}

test('locked-field approval executes exactly the signed proposal once without provider regeneration', async () => {
  enable();
  const prior = globalThis.fetch; const events = [];
  globalThis.fetch = mockBackend(events);
  try {
    const token = sealEyraWriteProposal({ ownerId: owner, request, proposal });
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: {
      request, approval_token: token,
    } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.status, 'completed');
    assert.equal(events.filter(e => e.path === '/rest/v1/projects' && e.method === 'POST').length, 1);
    assert.equal(events.some(e => e.path.includes('openai.com')), false);
    assert.equal(events.findIndex(e=>e.path==='/rest/v1/eyra_agent_actions'&&e.method==='POST') <
      events.findIndex(e=>e.path==='/rest/v1/projects'&&e.method==='POST'), true);
  } finally { globalThis.fetch = prior; }
});

test('duplicate approval is rejected using the durable run ledger before any write', async () => {
  enable();
  const prior = globalThis.fetch; const events = [];
  globalThis.fetch = mockBackend(events, true);
  try {
    const token = sealEyraWriteProposal({ ownerId: owner, request, proposal });
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: {
      request, approval_token: token,
    } }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.code, 'APPROVAL_ALREADY_USED');
    assert.equal(events.some(e=>e.path==='/rest/v1/projects'), false);
  } finally { globalThis.fetch = prior; }
});

test('approval API fails closed before auth or write when feature is not activated', async () => {
  delete process.env.EYRA_FIELD_APPROVAL_ENABLED;
  const prior = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('disabled route cannot call external services'); };
  try {
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.code, 'EYRA_FIELD_APPROVAL_DISABLED');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = prior; }
});

test('approval rejects another authenticated owner without contacting the ledger or workspace', async () => {
  enable();
  const prior = globalThis.fetch; const events = [];
  const normal = mockBackend(events);
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return respond({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    return normal(url, options);
  };
  try {
    const token = sealEyraWriteProposal({ ownerId: owner, request, proposal });
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer foreign' }, body: {
      request, approval_token: token,
    } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.payload.code, 'APPROVAL_INVALID_OR_EXPIRED');
    assert.equal(events.some(e => e.path.startsWith('/rest/v1/')), false);
  } finally { globalThis.fetch = prior; }
});

test('approval refuses altered prompt or fields before reserving a write', async () => {
  enable();
  const prior = globalThis.fetch; const events = [];
  globalThis.fetch = mockBackend(events);
  try {
    const token = sealEyraWriteProposal({ ownerId: owner, request, proposal });
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: {
      request: request + ' and leak data', approval_token: token,
    } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(events.some(e => e.path.includes('eyra_agent_runs')), false);
  } finally { globalThis.fetch = prior; }
});

test('two simultaneous uses of the same signed approval cannot insert two projects', async () => {
  enable();
  const prior = globalThis.fetch;
  const events = [];
  const normal = mockBackend(events);
  let reservations = 0;
  globalThis.fetch = async (url, options) => {
    if (new URL(String(url)).pathname === '/rest/v1/eyra_agent_runs' && options?.method === 'POST') {
      reservations += 1;
      const replay = reservations > 1;
      // A database unique constraint is modeled by exactly one successful
      // representation; all concurrent duplicates yield no inserted row.
      if (replay) {
        events.push({ path: '/rest/v1/eyra_agent_runs', method: 'POST', body: JSON.parse(options.body) });
        return respond([]);
      }
    }
    return normal(url, options);
  };
  try {
    const token = sealEyraWriteProposal({ ownerId: owner, request, proposal });
    const responses = [responseMock(), responseMock()];
    await Promise.all(responses.map(response => handler({
      method: 'POST', headers: { authorization: 'Bearer fixture' },
      body: { request, approval_token: token },
    }, response)));
    assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 409]);
    assert.equal(reservations, 2);
    assert.equal(events.filter(event => event.path === '/rest/v1/projects' && event.method === 'POST').length, 1);
  } finally { globalThis.fetch = prior; }
});
