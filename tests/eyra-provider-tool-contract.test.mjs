import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from '../api/eyra.js';

const envNames = [
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY', 'EYRA_DURABLE_RUNS_ENABLED',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
];
const saved = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const owner = '10000000-0000-4000-8000-000000000001';

function configure() {
  for (const key of envNames) delete process.env[key];
  Object.assign(process.env, {
    VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    SUPABASE_SECRET_KEY: 'sb_secret_fixture',
    OPENAI_API_KEY: 'sk_provider_fixture',
  });
}
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envNames) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});
function mockResponse() {
  return {
    statusCode: 200, payload: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(status) { this.statusCode = status; return this; },
    json(data) { this.payload = data; return this; },
  };
}
function ok(value) { return new Response(JSON.stringify(value), { status: 200 }); }
function mockProviderCalls({ toolName = 'project_list', argumentsJson = '{}' } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    calls.push({ address, init });
    if (address.endsWith('/auth/v1/user')) return ok({ id: owner });
    if (address.endsWith('/rpc/reserve_eyra_usage')) return ok([{ allowed: true, used: 1 }]);
    if (address.includes('/rest/v1/projects?')) return ok([]);
    if (address === 'https://api.openai.com/v1/responses') {
      const number = calls.filter(call => call.address === address).length;
      if (number === 1) return ok({
        id: 'resp_tool_one', status: 'completed', output: [{
          type: 'function_call', call_id: 'call_tool_one',
          name: toolName, arguments: argumentsJson,
        }],
      });
      return ok({
        id: 'resp_tool_final', status: 'completed', output: [{
          type: 'message', content: [{ type: 'output_text', text: 'The requested operation was evaluated.' }],
        }],
      });
    }
    throw new Error('Unexpected endpoint ' + address);
  };
  return calls;
}
async function invoke(body) {
  const res = mockResponse();
  await handler({
    method: 'POST', headers: { authorization: 'Bearer test-access-token' },
    body: { prompt: 'List the projects I saved.', enable_project_tools: true, ...body },
  }, res);
  return res;
}

test('both Responses API rounds only advertise valid function names', async () => {
  configure();
  const calls = mockProviderCalls();
  const res = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.actions.length, 1);
  assert.equal(res.payload.actions[0].tool, 'project.list', 'internal audit names remain canonical');
  assert.equal(res.payload.actions[0].status, 'succeeded');
  const providerCalls = calls.filter(call => call.address === 'https://api.openai.com/v1/responses');
  assert.equal(providerCalls.length, 2);
  for (const call of providerCalls) {
    const body = JSON.parse(call.init.body);
    assert.ok(body.tools.length >= 12);
    for (const tool of body.tools) {
      assert.match(tool.name, /^[A-Za-z0-9_-]{1,128}$/);
      assert.ok(!tool.name.includes('.'), 'dot-separated EYLO IDs are not valid function names');
    }
    assert.ok(body.tools.some(tool => tool.name === 'project_list'));
    assert.ok(body.tools.some(tool => tool.name === 'research_search_publications'));
  }
  const secondBody = JSON.parse(providerCalls[1].init.body);
  assert.equal(secondBody.input[1].name, 'project_list');
  assert.equal(secondBody.input[2].type, 'function_call_output');
  assert.ok(calls.some(call => call.address.includes('/rest/v1/projects?')));
});

test('provider-safe project_create still requires explicit user write consent', async () => {
  configure();
  const calls = mockProviderCalls({
    toolName: 'project_create',
    argumentsJson: JSON.stringify({
      title: 'Unapproved project', description: '', goal: '', milestones: '', tasks: '',
    }),
  });
  const res = await invoke({ prompt: 'Give me ideas for a future project.' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.actions[0].tool, 'project.create');
  assert.equal(res.payload.actions[0].status, 'failed');
  assert.match(res.payload.actions[0].error, /explicit|confirmation/i);
  assert.equal(calls.some(call => call.init.method === 'POST' && call.address.includes('/rest/v1/projects')), false);
});

test('legacy dotted calls remain limited to the existing allowlist', async () => {
  configure();
  const calls = mockProviderCalls({ toolName: 'project.list' });
  const res = await invoke();
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.actions[0].tool, 'project.list');
  assert.equal(calls.filter(call => call.address.includes('/rest/v1/projects?')).length, 1);
});
