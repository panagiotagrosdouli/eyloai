import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

const savedEnv = Object.fromEntries([
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
].map((key) => [key, process.env[key]]));
Object.assign(process.env, {
  VITE_SUPABASE_URL: 'https://eyra-tools-test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  OPENAI_API_KEY: 'sk-test-placeholder-only',
});
for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID']) delete process.env[key];
after(() => Object.entries(savedEnv).forEach(([key, value]) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}));

function responseMock() {
  return {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('explicit project request uses the authenticated RLS route and reports the verified record', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  let openAiCount = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    calls.push({ address, options });
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address === 'https://api.openai.com/v1/responses') {
      openAiCount += 1;
      return new Response(JSON.stringify(openAiCount === 1 ? {
        id: 'resp_tool_call', status: 'completed', output: [{
          type: 'function_call', call_id: 'call_create_1', name: 'project.create',
          arguments: JSON.stringify({ title: 'Explainable diagnosis', description: 'Study project', goal: 'Evaluate explanations', milestones: 'Protocol\nData collection', tasks: 'Draft protocol', }),
        }],
      } : { id: 'resp_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Created project Explainable diagnosis (id: project-1).' }] }] }), { status: 200 });
    }
    if (address.includes('/rest/v1/projects?select=id,data,created_date,updated_date')) {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.authorization, 'Bearer user-access-token');
      const payload = JSON.parse(options.body);
      assert.equal(payload.user_id, 'user-a');
      return new Response(JSON.stringify([{ id: 'project-1', data: payload.data, created_date: '2026-11-11T00:00:00Z' }]), { status: 201 });
    }
    throw new Error(`Unexpected request ${address}`);
  };
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' }, body: {
      prompt: 'Create a project about explainable diagnosis and add milestones.',
      tool_intent: 'Create a project about explainable diagnosis and add milestones.', enable_project_tools: true,
    } }, response);
    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /Created project Explainable diagnosis/);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(response.payload.actions[0].result.id, 'project-1');
    assert.equal(response.payload.actions[0].result.verified, true);
    assert.equal(calls.filter((call) => call.address.includes('/rest/v1/projects')).length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('project tool mode refuses a create tool call without explicit user intent', async () => {
  const previousFetch = globalThis.fetch;
  let projectWrites = 0;
  let openAiCount = 0;
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address === 'https://api.openai.com/v1/responses') {
      openAiCount += 1;
      return new Response(JSON.stringify(openAiCount === 1 ? {
        id: 'resp_tool_call', status: 'completed', output: [{
          type: 'function_call', call_id: 'call_create_1', name: 'project.create',
          arguments: JSON.stringify({ title: 'Should not exist', description: '', goal: '', milestones: '', tasks: '' }),
        }],
      } : { id: 'resp_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'I could not create a project because you asked only for advice.' }] }] }), { status: 200 });
    }
    if (address.includes('/rest/v1/projects')) projectWrites += 1;
    throw new Error(`Unexpected request ${address}`);
  };
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' }, body: {
      prompt: 'What would be a good project about explainable diagnosis?',
      tool_intent: 'What would be a good project about explainable diagnosis?', enable_project_tools: true,
    } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(projectWrites, 0);
    assert.equal(response.payload.actions[0].status, 'failed');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('explicit paper-save request verifies DOI metadata and persists the Crossref record', async () => {
  const previousFetch = globalThis.fetch;
  let openAiCount = 0;
  let savedPayload;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address === 'https://api.openai.com/v1/responses') {
      openAiCount += 1;
      return new Response(JSON.stringify(openAiCount === 1 ? {
        id: 'resp_save_call', status: 'completed', output: [{
          type: 'function_call', call_id: 'call_save_1', name: 'library.save_paper',
          arguments: JSON.stringify({ doi: '10.1234/example', title: 'Verified paper title' }),
        }],
      } : { id: 'resp_save_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'The verified paper is now in your Library.' }] }] }), { status: 200 });
    }
    if (address === 'https://api.crossref.org/works/10.1234%2Fexample') {
      return new Response(JSON.stringify({ message: {
        DOI: '10.1234/example', title: ['Verified paper title'],
        author: [{ given: 'Ada', family: 'Researcher' }],
        published: { 'date-parts': [[2024, 3, 1]] }, 'container-title': ['Journal of Tests'],
      } }), { status: 200 });
    }
    if (address.includes('/rest/v1/saved_papers?') && options.method !== 'POST') return new Response('[]', { status: 200 });
    if (address.includes('/rest/v1/saved_papers?') && options.method === 'POST') {
      savedPayload = JSON.parse(options.body);
      return new Response(JSON.stringify([{ id: 'paper-1', data: savedPayload.data, created_date: '2026-11-11T00:00:00Z' }]), { status: 201 });
    }
    throw new Error(`Unexpected request ${address}`);
  };
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' }, body: {
      prompt: 'Save this paper to my Library.',
      tool_intent: 'Save this paper to my Library.',
      enable_project_tools: true,
    } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(response.payload.actions[0].result.id, 'paper-1');
    assert.equal(response.payload.actions[0].result.verified, true);
    assert.equal(savedPayload.data.source_id, 'doi:10.1234/example');
    assert.equal(savedPayload.data.authors, 'Ada Researcher');
    assert.equal(savedPayload.data.year, 2024);
    assert.equal(savedPayload.data.summary, '');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
