import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  durableRunsEnabled, requestFingerprint, startAgentRun, reserveAgentAction,
  completeAgentAction, finalizeAgentRun, isAgentRunCancelled,
} from '../server/eyra-run-ledger.mjs';

const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const requestId = '10000000-0000-4000-8000-000000000001';
const runId = '20000000-0000-4000-8000-000000000001';
const actionId = '30000000-0000-4000-8000-000000000001';
const identity = {
  user: { id: owner }, supabaseUrl: 'https://ledger-test.supabase.co',
  serverKey: 'sb_secret_test',
};
const savedFlag = process.env.EYRA_DURABLE_RUNS_ENABLED;
after(() => {
  if (savedFlag === undefined) delete process.env.EYRA_DURABLE_RUNS_ENABLED;
  else process.env.EYRA_DURABLE_RUNS_ENABLED = savedFlag;
});

function respond(rows, status = 200) {
  return new Response(JSON.stringify(rows), { status });
}

test('feature gate is disabled until explicitly enabled; fingerprint is stable', () => {
  delete process.env.EYRA_DURABLE_RUNS_ENABLED;
  assert.equal(durableRunsEnabled(), false);
  process.env.EYRA_DURABLE_RUNS_ENABLED = 'true';
  assert.equal(durableRunsEnabled(), true);
  assert.equal(requestFingerprint({ task: 'a' }), requestFingerprint({ task: 'a' }));
  assert.notEqual(requestFingerprint({ task: 'a' }), requestFingerprint({ task: 'b' }));
});

test('run identity is reserved once; duplicate, foreign and conflicting IDs never create a new run', async () => {
  const previousFetch = globalThis.fetch;
  const hash = requestFingerprint({ prompt: 'Create my project.' });
  let insertions = 0;
  let foreignOnConflict = false;
  let conflict = false;
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, '/rest/v1/eyra_agent_runs');
    assert.equal(options.headers.apikey, 'sb_secret_test');
    assert.equal(options.headers.authorization, undefined, 'user bearer must not impersonate service credentials');
    if (options.method === 'POST') {
      insertions++;
      assert.equal(parsed.searchParams.get('on_conflict'), 'user_id,request_id');
      assert.equal(options.headers.prefer, 'resolution=ignore-duplicates,return=representation');
      const body = JSON.parse(options.body);
      assert.equal(body.user_id, owner);
      assert.equal(body.request_id, requestId);
      assert.equal(body.request_hash, hash);
      return respond(insertions === 1 ? [{ id: runId, user_id: owner, request_id: requestId }] : []);
    }
    assert.equal(options.method, 'GET');
    assert.equal(parsed.searchParams.get('user_id'), 'eq.' + owner);
    assert.equal(parsed.searchParams.get('request_id'), 'eq.' + requestId);
    return respond([{
      id: runId, user_id: foreignOnConflict ? foreign : owner, request_id: requestId,
      request_hash: conflict ? requestFingerprint({ prompt: 'other' }) : hash,
      status: 'running',
    }]);
  };
  try {
    const first = await startAgentRun(identity, requestId, hash, 'Create my project.');
    assert.deepEqual(first, { id: runId, created: true, status: 'running' });
    const retry = await startAgentRun(identity, requestId, hash, 'Create my project.');
    assert.equal(retry.created, false);
    assert.equal(retry.conflict, false);
    conflict = true;
    const mismatched = await startAgentRun(identity, requestId, hash, 'Create my project.');
    assert.equal(mismatched.conflict, true);
    foreignOnConflict = true;
    await assert.rejects(() => startAgentRun(identity, requestId, hash, 'Create my project.'), /could not be verified/);
    assert.equal(insertions, 4, 'all replays attempt conflict-safe inserts, never overwrite');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('action is reserved only once before a side effect; uncertain result never authorizes replay', async () => {
  const previousFetch = globalThis.fetch;
  let actionInserts = 0;
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, '/rest/v1/eyra_agent_actions');
    if (options.method === 'POST') {
      actionInserts++;
      assert.equal(parsed.searchParams.get('on_conflict'), 'run_id,call_id');
      assert.equal(JSON.parse(options.body).user_id, owner);
      return respond(actionInserts === 1 ? [{
        id: actionId, run_id: runId, user_id: owner,
        call_id: 'call_1', status: 'started',
      }] : []);
    }
    assert.equal(options.method, 'PATCH');
    assert.equal(parsed.searchParams.get('user_id'), 'eq.' + owner);
    assert.equal(parsed.searchParams.get('status'), 'eq.started');
    assert.equal(JSON.parse(options.body).status, 'needs_review');
    return respond([{ id: actionId, status: 'needs_review' }]);
  };
  try {
    const hash = requestFingerprint({ args: '{}' });
    assert.deepEqual(await reserveAgentAction(identity, runId, 'call_1', 'project.create', hash),
      { reserved: true, id: actionId });
    await completeAgentAction(identity, actionId, 'needs_review', { reason: 'transport_lost' });
    assert.deepEqual(await reserveAgentAction(identity, runId, 'call_1', 'project.create', hash),
      { reserved: false });
    assert.equal(actionInserts, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('successful completion must be confirmed with owner predicate and running-state CAS', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, '/rest/v1/eyra_agent_runs');
    assert.equal(options.method, 'PATCH');
    assert.equal(parsed.searchParams.get('id'), 'eq.' + runId);
    assert.equal(parsed.searchParams.get('user_id'), 'eq.' + owner);
    assert.equal(parsed.searchParams.get('status'), 'eq.running');
    const body = JSON.parse(options.body);
    assert.equal(body.status, 'completed');
    assert.equal(body.action_summary[0].record_id, 'project-1');
    assert.equal(body.response_text, 'Project created.');
    return respond([{ id: runId, status: 'completed' }]);
  };
  try {
    await finalizeAgentRun(identity, runId, 'completed', 'Project created.', [{
      action_id: 'call_1', tool: 'project.create', status: 'succeeded',
      result: { id: 'project-1', secret: 'private-do-not-log' },
    }]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('cancellation and malformed durable IDs fail closed', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const u = new URL(String(url));
    assert.equal(u.searchParams.get('user_id'), 'eq.' + owner);
    assert.equal(options.method, 'GET');
    return respond([{ id: runId, status: 'cancelled' }]);
  };
  try {
    assert.equal(await isAgentRunCancelled(identity, runId), true);
    await assert.rejects(() => reserveAgentAction(identity, 'invalid', 'call', 'project.create', 'abc'),
      /Invalid agent action/);
    await assert.rejects(() => startAgentRun(identity, 'invalid', 'a'.repeat(64), 'test'),
      /Invalid durable run/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('ledger HTTP failures never become successful action reservations', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => respond({ error: 'not found' }, 404);
  try {
    await assert.rejects(() => reserveAgentAction(identity, runId, 'call_1',
      'project.create', requestFingerprint({ call: 1 })), /storage request failed/);
  } finally { globalThis.fetch = previousFetch; }
});
