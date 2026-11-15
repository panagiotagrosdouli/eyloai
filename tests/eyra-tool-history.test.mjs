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

test('duplicate provider call IDs abort without another tool execution or provider follow-up', async () => {
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
    assert.equal(response.statusCode, 502);
    assert.equal(response.payload.code, 'INVALID_TOOL_SEQUENCE');
    assert.equal(reads, 1, 'duplicate provider call ID must not execute again');
    assert.equal(response.payload.actions.length, 2);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(response.payload.actions[1].status, 'failed');
    assert.match(response.payload.actions[1].error, /Duplicate or invalid/);
    assert.equal(modelInputs.length, 2, 'invalid tool sequence stops further provider calls');
    assert.equal(modelInputs[1].length, 3, 'first follow-up includes user, call and result');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('multi-round tool history retains every distinct prior call and output', async () => {
  const previousFetch = globalThis.fetch;
  const modelInputs = [];
  let reads = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address.includes('/rest/v1/projects?')) {
      reads += 1;
      return new Response('[]', { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      const body = JSON.parse(options.body);
      modelInputs.push(body.input);
      const n = modelInputs.length;
      return new Response(JSON.stringify(n < 3
        ? { id: 'resp_' + n, status: 'completed', output: [{
          type: 'function_call', name: 'project.list', call_id: 'unique-' + n, arguments: '{}',
        }] }
        : { id: 'resp_final', status: 'completed', output: [{ content: [{
          type: 'output_text', text: 'Two project lookups complete.',
        }] }] }
      ), { status: 200 });
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'List my research projects.', enable_project_tools: true },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(reads, 2);
    assert.equal(modelInputs.length, 3);
    assert.equal(modelInputs[1].length, 3);
    assert.equal(modelInputs[2].length, 5);
    assert.deepEqual(modelInputs[2].filter(item => item.type === 'function_call_output')
      .map(item => item.call_id), ['unique-1', 'unique-2']);
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

test('scholarly search validates and caps Crossref results without claiming full text', async () => {
  const previousFetch = globalThis.fetch;
  let openAiCalls = 0;
  let queryUrl;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address.startsWith('https://api.crossref.org/works?')) {
      queryUrl = new URL(address);
      return new Response(JSON.stringify({ message: { items: [
        { DOI: '10.1234/test', title: ['Credible article'], author: [{ given: 'A', family: 'Researcher' }], published: { 'date-parts': [[2024]] } },
        { DOI: 'unverified', title: ['Invalid DOI'] },
      ] } }), { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      openAiCalls += 1;
      if (openAiCalls === 2) {
        const input = JSON.parse(options.body).input;
        const output = JSON.parse(input.at(-1).output);
        assert.equal(output.ok, true);
        assert.equal(output.result.records.length, 1);
        assert.equal(output.result.records[0].evidence_level, 'bibliographic_metadata_only');
      }
      return new Response(JSON.stringify(openAiCalls === 1
        ? { id: 'search_call', status: 'completed', output: [{
          type: 'function_call', call_id: 'search-1', name: 'research.search_publications',
          arguments: JSON.stringify({ query: 'explainable artificial intelligence' }),
        }] }
        : { id: 'search_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'One validated bibliographic result.' }] }] }
      ), { status: 200 });
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'Find scholarly publications about explainable artificial intelligence.', enable_project_tools: true },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(queryUrl.searchParams.get('rows'), '5');
    assert.equal(queryUrl.searchParams.get('query.bibliographic'), 'explainable artificial intelligence');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('project.get retrieves only an owner-scoped UUID record', async () => {
  const previousFetch = globalThis.fetch;
  const projectId = '123e4567-e89b-42d3-a456-426614174000';
  let modelCount = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address.includes('/rest/v1/projects?')) {
      const params = new URL(address).searchParams;
      assert.equal(params.get('user_id'), 'eq.user-a');
      assert.equal(params.get('id'), 'eq.' + projectId);
      assert.equal(options.method, undefined);
      return new Response(JSON.stringify([{ id: projectId, data: { title: 'Owner research project' }, created_date: '2026-11-15T00:00:00Z' }]), { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      modelCount += 1;
      return new Response(JSON.stringify(modelCount === 1
        ? { id: 'project_get_call', status: 'completed', output: [{
          type: 'function_call', call_id: 'get-1', name: 'project.get',
          arguments: JSON.stringify({ id: projectId }),
        }] }
        : { id: 'project_get_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Owner project found.' }] }] }
      ), { status: 200 });
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'Read details for my project ' + projectId, enable_project_tools: true },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.actions[0].status, 'succeeded');
    assert.equal(response.payload.actions[0].result.id, projectId);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('private workspace read tools always apply owner predicates and bounded previews', async () => {
  const previousFetch = globalThis.fetch;
  const toolTable = [
    ['notes.list', 'notes'],
    ['tasks.list', 'life_tasks'],
    ['calendar.list_events', 'calendar_events'],
  ];
  let next = 0;
  let modelCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address.startsWith('https://eyra-tool-history-test.supabase.co/rest/v1/')) {
      const parsed = new URL(address);
      assert.equal(parsed.pathname, '/rest/v1/' + toolTable[next][1]);
      assert.equal(parsed.searchParams.get('user_id'), 'eq.user-a');
      assert.equal(parsed.searchParams.get('limit'), '20');
      assert.equal(options.method, undefined);
      next += 1;
      return new Response(JSON.stringify([{ id: 'record-' + next, data: {
        title: 'Private record', content: 'x'.repeat(500), status: 'open',
      }, updated_date: '2026-11-15T00:00:00Z' }]), { status: 200 });
    }
    if (address === 'https://api.openai.com/v1/responses') {
      modelCalls += 1;
      if (modelCalls === 2) {
        const input = JSON.parse(options.body).input;
        assert.equal(input.length, 7);
        const outputs = input.filter(item => item.type === 'function_call_output')
          .map(item => JSON.parse(item.output));
        assert.equal(outputs.length, 3);
        assert.equal(outputs[0].result[0].preview.length, 300);
        assert.equal(outputs[1].result[0].preview, '');
        assert.equal(outputs[2].result[0].preview, '');
      }
      return new Response(JSON.stringify(modelCalls === 1
        ? { id: 'workspace_call', status: 'completed', output: toolTable.map(([name], i) => ({
          type: 'function_call', name, call_id: 'read-' + i, arguments: '{}',
        })) }
        : { id: 'workspace_final', status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Workspace records summarized.' }] }] }
      ), { status: 200 });
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'List my notes, tasks, and calendar events.', enable_project_tools: true },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.actions.length, 3);
    assert.equal(next, 3);
    assert.ok(response.payload.actions.every(action => action.status === 'succeeded'));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('authorized contextual resource is resolved under bearer and owner, not from browser text', async () => {
  const previousFetch = globalThis.fetch;
  const id = '123e4567-e89b-42d3-a456-426614174000';
  let modelSeen = false;
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.includes('/rest/v1/projects?')) {
      const u = new URL(address);
      assert.equal(u.searchParams.get('user_id'), 'eq.user-a');
      assert.equal(u.searchParams.get('id'), 'eq.' + id);
      assert.equal(options.headers.authorization, 'Bearer user-access-token');
      return new Response(JSON.stringify([{ id, data: {
        title: 'Research project',
        description: 'Untrusted project description',
        private_token: 'must-not-be-sent',
      } }]), { status: 200 });
    }
    if (address.endsWith('/rest/v1/rpc/reserve_eyra_usage')) return new Response(JSON.stringify([{ allowed: true, used: 1 }]), { status: 200 });
    if (address === 'https://api.openai.com/v1/responses') {
      const input = JSON.parse(options.body);
      assert.match(input.instructions, /Research project/);
      assert.match(input.instructions, /untrusted data/i);
      assert.doesNotMatch(input.instructions, /must-not-be-sent/);
      modelSeen = true;
      return new Response(JSON.stringify({ id: 'context_final', status: 'completed',
        output: [{ content: [{ type: 'output_text', text: 'Based on your project context.' }] }],
      }), { status: 200 });
    }
    throw new Error('Unexpected request ' + address);
  };
  try {
    const response = responseMock();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer user-access-token' },
      body: { prompt: 'Explain this project.', resource_context: { kind: 'project', id } },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(modelSeen, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('context rejects invalid or unauthorized resources before quota reservation or provider call', async () => {
  const previousFetch = globalThis.fetch;
  const id = '123e4567-e89b-42d3-a456-426614174000';
  let quotaCalls = 0;
  let aiCalls = 0;
  globalThis.fetch = async url => {
    const address = String(url);
    if (address.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-a' }), { status: 200 });
    if (address.includes('/rest/v1/projects?')) return new Response('[]', { status: 200 });
    if (address.includes('/reserve_eyra_usage')) quotaCalls += 1;
    if (address.includes('api.openai.com')) aiCalls += 1;
    throw new Error('Unexpected request ' + address);
  };
  try {
    for (const [resource_context, status, code] of [
      [{ kind: 'project', id: 'not-an-id' }, 400, 'INVALID_RESOURCE_CONTEXT'],
      [{ kind: 'unknown', id }, 400, 'INVALID_RESOURCE_CONTEXT'],
      [{ kind: 'project', id, injected: true }, 400, 'INVALID_RESOURCE_CONTEXT'],
      [{ kind: 'project', id }, 404, 'RESOURCE_NOT_FOUND'],
    ]) {
      const response = responseMock();
      await handler({
        method: 'POST', headers: { authorization: 'Bearer user-access-token' },
        body: { prompt: 'Describe resource.', resource_context },
      }, response);
      assert.equal(response.statusCode, status);
      assert.equal(response.payload.code, code);
    }
    assert.equal(quotaCalls, 0);
    assert.equal(aiCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
