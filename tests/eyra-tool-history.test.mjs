import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

const envKeys = [
  'VITE_SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
];
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
Object.assign(process.env, {
  VITE_SUPABASE_URL: 'https://eyra-tool-history-test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  OPENAI_API_KEY: 'sk-test-placeholder-only',
});
for (const key of envKeys.slice(4)) delete process.env[key];
after(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function responseMock() {
  return {
    statusCode: 200, payload: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('multi-round tool history retains previous results and repeated call IDs are not executed twice', async () => {
  const previousFetch = globalThis.fetch;
  let reads = 0;
  const modelInputs = [];
  const toolCall = {
    type: 'function_call',
    name: 'project.list',
    call_id: 'same-call-id',
    arguments: '{}',
  };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    }
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) {
      return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    }
    if (address.includes('/rest/v1/projects?')) {
      reads += 1;
      return new Response('[]', { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      const body = JSON.parse(options.body);
      modelInputs.push(body.input);
      return new Response(JSON.stringify(modelInputs.length <= 2
        ? { id: 'resp_' + modelInputs.length, status: 'completed', output: [toolCall] }
        : { id: 'resp_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Completed with one verified project-list lookup.' }] }] }
      ), { status: 200 });
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'List my projects.', tool_intent: 'List my projects.', enable_project_tools: true },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(reads, 1, 'duplicate provider call ID must not execute again');
    assert.equal(response.payload.actions.length, 2);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(response.payload.actions[1].status, 'failed');
    assert.match(response.payload.actions[1].error, /Duplicate or invalid/);
    assert.equal(modelInputs.length, 3);
    assert.equal(modelInputs[1].length, 3, 'first follow-up includes user, call and result');
    assert.equal(modelInputs[2].length, 5, 'second follow-up includes both tool exchanges');
    assert.equal(modelInputs[2][2].type, 'function_call_output');
    assert.equal(modelInputs[2][4].type, 'function_call_output');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('browser tool_intent cannot authorize a project write absent from prompt', async () => {
  const previousFetch = globalThis.fetch;
  let writes = 0;
  let modelRequests = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address === 'https://api.openai.com/v1/responses') {
      modelRequests += 1;
      return new Response(JSON.stringify(modelRequests === 1
        ? { id: 'tool_attempt', status: 'completed', output: [{
          type: 'function_call', call_id: 'create_1', name: 'project.create',
          arguments: JSON.stringify({ title: 'Unauthorized', description: '', goal: '', milestones: '', tasks: '' }),
        }] }
        : { id: 'final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'No project was created.' }] }] }
      ), { status: 200 });
    }
    if (address.includes('/rest/v1/projects')) {
      writes += 1;
      throw new Error('Unexpected database write');
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer user-access-token' },
      body: {
        prompt: 'What are the benefits of starting a research project?',
        tool_intent: 'Create a project named Unauthorized',
        enable_project_tools: true,
      },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(writes, 0);
    assert.equal(response.payload.actions[0].status, 'failed');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('DOI research lookup returns Crossref metadata with explicit evidence limitations', async () => {
  const previousFetch = globalThis.fetch;
  let modelCount = 0;
  let savedPapers = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address === 'https://api.openai.com/v1/responses') {
      modelCount += 1;
      if (modelCount === 2) {
        const input = JSON.parse(options.body).input;
        const result = JSON.parse(input.at(-1).output);
        assert.equal(result.ok, true);
        assert.equal(result.result.doi, '10.1234/example');
        assert.equal(result.result.evidence_level, 'bibliographic_metadata_only');
        assert.equal(result.result.title, 'Verified research article');
      }
      return new Response(JSON.stringify(modelCount === 1
        ? { id: 'lookup_call', status: 'completed', output: [{
          type: 'function_call', name: 'research.lookup_doi', call_id: 'lookup-1',
          arguments: JSON.stringify({ doi: '10.1234/example' }),
        }] }
        : { id: 'final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Crossref metadata retrieved; full text not analyzed.' }] }] }
      ), { status: 200 });
    }
    if (address === 'https://api.crossref.org/works/10.1234%2Fexample') {
      return new Response(JSON.stringify({ message: {
        DOI: '10.1234/example', title: ['Verified research article'],
        author: [{ given: 'Jane', family: 'Researcher' }],
        published: { 'date-parts': [[2025, 1, 1]] },
        'container-title': ['Research Journal'],
      } }), { status: 200 });
    }
    if (address.includes('/rest/v1/saved_papers')) savedPapers += 1;
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'Find metadata for DOI 10.1234/example.', enable_project_tools: true },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(savedPapers, 0);
    assert.equal(response.payload.actions[0].result.source, 'Crossref');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
