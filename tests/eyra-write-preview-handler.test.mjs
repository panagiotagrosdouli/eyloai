import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

const keys = [
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
process.env.VITE_SUPABASE_URL = 'https://preview-only.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_fixture';
process.env.OPENAI_API_KEY = 'sk-fixture-only';
for (const key of keys.slice(4)) delete process.env[key];
after(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function responseMock() {
  return {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function fixtureFetch(output, observed) {
  return async (url, options = {}) => {
    const path = String(url);
    observed.push({ path, method: options.method || 'GET' });
    if (path.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'fixture-owner' }), { status: 200 });
    }
    if (path.endsWith('/rest/v1/rpc/reserve_eyra_usage')) {
      return new Response('[{"allowed":true,"used":1}]', { status: 200 });
    }
    if (path.endsWith('/rest/v1/rpc/release_eyra_usage')) {
      return new Response('true', { status: 200 });
    }
    if (path === 'https://api.openai.com/v1/responses') {
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.tools.length, 2);
      assert.deepEqual(body.tools.map(tool => tool.name).sort(), ['library.save_paper', 'project.create']);
      assert.match(body.instructions, /preview-only request/);
      return new Response(JSON.stringify({
        status: 'completed', id: 'resp_fixture', model: 'fixture-model', output,
      }), { status: 200 });
    }
    throw new Error('Preview unexpectedly called ' + path);
  };
}

test('preview API returns proposed project fields without calling any workspace write', async () => {
  const prior = globalThis.fetch;
  const calls = [];
  globalThis.fetch = fixtureFetch([{
    type: 'function_call', name: 'project.create', call_id: 'call_a',
    arguments: JSON.stringify({ title: 'Research audit', description: 'Draft only', goal: 'Reproducibility', milestones: '', tasks: '' }),
  }], calls);
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: {
      prompt: 'Create a project about reproducibility',
      latest_user_request: 'Create a project about reproducibility',
      enable_project_tools: true, preview_write_actions: true,
    } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.preview_only, true);
    assert.equal(response.payload.write_proposals[0].fields.title, 'Research audit');
    assert.match(response.payload.text, /No record has been created or saved/);
    assert.equal(calls.filter(call => call.path === 'https://api.openai.com/v1/responses').length, 1);
    assert.equal(calls.some(call => call.path.includes('/rest/v1/projects') || call.path.includes('/rest/v1/saved_papers')), false);
  } finally { globalThis.fetch = prior; }
});

test('malicious model-proposed action never reaches the executor', async () => {
  const prior = globalThis.fetch;
  const calls = [];
  globalThis.fetch = fixtureFetch([{
    type: 'function_call', name: 'project.list', call_id: 'call_bad', arguments: '{}',
  }], calls);
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: {
      prompt: 'Create a project about reproducibility',
      latest_user_request: 'Create a project about reproducibility',
      enable_project_tools: true, preview_write_actions: true,
    } }, response);
    assert.equal(response.statusCode, 422);
    assert.equal(response.payload.code, 'INVALID_WRITE_PROPOSAL');
    assert.equal(calls.some(call => call.path.includes('/rest/v1/projects')), false);
    assert.ok(calls.some(call => call.path.endsWith('/rest/v1/rpc/release_eyra_usage')));
  } finally { globalThis.fetch = prior; }
});

test('preview API rejects pre-confirmed or non-write requests before any provider call', async () => {
  const prior = globalThis.fetch;
  const calls = [];
  globalThis.fetch = fixtureFetch([], calls);
  try {
    for (const body of [
      { prompt: 'Explain research methods', latest_user_request: 'Explain research methods', enable_project_tools: true, preview_write_actions: true },
      { prompt: 'Create a project', latest_user_request: 'Create a project', enable_project_tools: true, preview_write_actions: true, write_confirmed: true },
    ]) {
      const response = responseMock();
      await handler({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.payload.code, 'INVALID_WRITE_PREVIEW');
    }
    assert.equal(calls.some(call => call.path.includes('api.openai.com')), false);
  } finally { globalThis.fetch = prior; }
});
