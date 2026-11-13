import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra-conversations.js';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const THREAD_A = '10000000-0000-4000-8000-000000000001';
const THREAD_B = '10000000-0000-4000-8000-000000000002';
const ABSENT = '10000000-0000-4000-8000-000000000099';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.VITE_SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture';
after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
});

function res() {
  return {
    statusCode: 200, payload: null, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(v) { this.statusCode = v; return this; },
    json(v) { this.payload = v; return this; },
  };
}

function setup() {
  const calls = [];
  globalThis.fetch = async (resource, opts) => {
    const url = new URL(String(resource));
    const token = opts.headers.authorization;
    const user = token === 'Bearer user-a' ? A : token === 'Bearer user-b' ? B : null;
    calls.push({ pathname: url.pathname, params: url.searchParams, token, method: opts.method || 'GET', key: opts.headers.apikey });
    assert.equal(url.origin, 'https://eylo-test.supabase.co');
    assert.equal(opts.headers.apikey, 'sb_publishable_fixture');
    assert.equal(opts.cache, 'no-store');
    assert.equal(opts.method, undefined, 'history must never perform a write');
    if (url.pathname === '/auth/v1/user') {
      return user
        ? new Response(JSON.stringify({ id: user }), { status: 200 })
        : new Response('{}', { status: 401 });
    }
    assert.ok(user, 'must authenticate before querying conversations');
    assert.equal(url.searchParams.get('user_id'), `eq.${user}`, 'explicit owner filtering required');
    assert.equal(url.searchParams.get('order') || '', url.pathname.includes('messages') ? 'sequence_number.asc,id.asc' : (url.searchParams.has('id') ? '' : 'updated_date.desc,id.desc'));
    const threads = [
      { id: THREAD_A, title: 'A private thread', user_id: A },
      { id: THREAD_B, title: 'B private thread', user_id: B },
    ];
    if (url.pathname === '/rest/v1/eyra_conversations') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      return Response.json(threads.filter(row => row.user_id === user && (!id || row.id === id)));
    }
    if (url.pathname === '/rest/v1/eyra_messages') {
      assert.equal(url.searchParams.get('conversation_id'), `eq.${THREAD_A}`);
      return Response.json([{ id: 'message-a', role: 'user', sequence_number: 1, content: { text: 'Private' } }]);
    }
    throw new Error('Unrecognized endpoint: ' + url.pathname);
  };
  return calls;
}

async function call(token, query = {}, method = 'GET') {
  const response = res();
  await handler({ method, headers: token ? { authorization: token } : {}, query }, response);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  return response;
}

test('User A and User B list only their own conversations with bounded deterministic ordering', async () => {
  const calls = setup();
  const a = await call('Bearer user-a', { page: '1', limit: '10' });
  const b = await call('Bearer user-b', { page: '1', limit: '10' });
  assert.equal(a.statusCode, 200);
  assert.deepEqual(a.payload.conversations.map(x => x.id), [THREAD_A]);
  assert.deepEqual(b.payload.conversations.map(x => x.id), [THREAD_B]);
  const list = calls.find(x => x.pathname.endsWith('eyra_conversations'));
  assert.equal(list.params.get('limit'), '10');
  assert.equal(list.params.get('offset'), '0');
  assert.equal(list.params.get('order'), 'updated_date.desc,id.desc');
});

test('foreign and absent IDs yield identical 404 responses without fetching messages', async () => {
  const calls = setup();
  const foreign = await call('Bearer user-b', { id: THREAD_A });
  const absent = await call('Bearer user-b', { id: ABSENT });
  assert.equal(foreign.statusCode, 404);
  assert.equal(absent.statusCode, 404);
  assert.deepEqual(foreign.payload, absent.payload);
  assert.equal(calls.filter(x => x.pathname.endsWith('eyra_messages')).length, 0);
});

test('owner loads messages ordered by sequence with bounded pagination', async () => {
  const calls = setup();
  const r = await call('Bearer user-a', { id: THREAD_A, page: '2', limit: '3' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.conversation.id, THREAD_A);
  assert.equal(r.payload.messages[0].content.text, 'Private');
  const messages = calls.find(x => x.pathname.endsWith('eyra_messages'));
  assert.equal(messages.params.get('offset'), '3');
  assert.equal(messages.params.get('limit'), '3');
});

test('unauthenticated and invalid tokens return 401 before database reads', async () => {
  const calls = setup();
  assert.equal((await call(null)).statusCode, 401);
  assert.equal((await call('Bearer invalid', { id: THREAD_A })).statusCode, 401);
  assert.equal(calls.filter(x => x.pathname.startsWith('/rest/')).length, 0);
});

test('invalid IDs, malformed pagination and invalid method fail closed', async () => {
  const calls = setup();
  assert.equal((await call('Bearer user-a', { id: 'not-uuid' })).statusCode, 400);
  assert.equal((await call('Bearer user-a', { id: [THREAD_A] })).statusCode, 400);
  assert.equal((await call('Bearer user-a', { limit: '100000' })).statusCode, 400);
  assert.equal((await call('Bearer user-a', { page: '-1' })).statusCode, 400);
  assert.equal((await call('Bearer user-a', {}, 'POST')).statusCode, 405);
  assert.equal(calls.length, 0);
});

test('read requests use no admin credential and no unrelated entity endpoints', async () => {
  const calls = setup();
  await call('Bearer user-a');
  await call('Bearer user-a', { id: THREAD_A });
  assert.ok(calls.every(c => c.key === 'sb_publishable_fixture'));
  assert.ok(calls.every(c => !/ideas|search_history|projects/.test(c.pathname)));
});
