import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra-conversation-write.js';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const CONVERSATION = '10000000-0000-4000-8000-000000000001';
const MESSAGE = '20000000-0000-4000-8000-000000000001';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.VITE_SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.VITE_SUPABASE_URL = 'https://eyra-fixture.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';
after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
});

function response() {
  return {
    statusCode: 200, payload: null, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(v) { this.statusCode = v; return this; },
    json(data) { this.payload = data; return this; },
  };
}
async function call(token, body, method = 'POST') {
  const res = response();
  await handler({ method, headers: token ? { authorization: token } : {}, body }, res);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  return res;
}
const create = (id = CONVERSATION) => ({ action: 'create', id, title: 'Private EYRA thread' });
const append = (id = CONVERSATION) => ({
  action: 'append', conversation_id: id, message_id: MESSAGE,
  role: 'user', content: { text: 'Remember this request.' },
});

function stub(options = {}) {
  const calls = [];
  globalThis.fetch = async (resource, opts) => {
    const url = new URL(String(resource));
    assert.equal(url.origin, 'https://eyra-fixture.supabase.co');
    assert.equal(opts.cache, 'no-store');
    assert.equal(opts.headers.apikey, 'sb_publishable_test_only');
    const identity = opts.headers.authorization === 'Bearer a' ? A
      : opts.headers.authorization === 'Bearer b' ? B : null;
    calls.push({ url, opts, identity });
    if (url.pathname === '/auth/v1/user') {
      return identity ? Response.json({ id: identity }) : Response.json({}, { status: 401 });
    }
    assert.ok(identity, 'must authenticate before writing');
    assert.ok(url.pathname.startsWith('/rest/v1/rpc/'), 'must not write directly to a table');
    assert.equal(opts.method, 'POST');
    assert.ok(opts.body);
    const body = JSON.parse(opts.body);
    if (options.errorCode) return Response.json({ code: options.errorCode, message: 'private SQL details' }, { status: 409 });
    if (options.failTransport) throw new Error('network failure');
    if (url.pathname.endsWith('/eyra_create_conversation')) {
      assert.deepEqual(Object.keys(body).sort(), ['p_id', 'p_title']);
      return Response.json({ id: body.p_id, title: body.p_title, version: 1 });
    }
    if (url.pathname.endsWith('/eyra_append_message')) {
      assert.deepEqual(Object.keys(body).sort(), ['p_conversation_id', 'p_message_id', 'p_role', 'p_text']);
      return Response.json({
        id: body.p_message_id, conversation_id: body.p_conversation_id,
        sequence_number: 1, role: body.p_role, content: { text: body.p_text },
      });
    }
    throw new Error('Unexpected request');
  };
  return calls;
}

test('owner creates a conversation through server-authenticated invoker RPC', async () => {
  const calls = stub();
  const saved = await call('Bearer a', create());
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.payload.conversation.id, CONVERSATION);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].opts.headers.authorization, 'Bearer a');
});

test('owner appends a message using caller-stable idempotency UUID', async () => {
  const calls = stub();
  const saved = await call('Bearer b', append());
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.payload.message.id, MESSAGE);
  assert.equal(saved.payload.message.sequence_number, 1);
  assert.equal(JSON.parse(calls[1].opts.body).p_message_id, MESSAGE);
  assert.equal(calls[1].identity, B);
});

test('unauthenticated callers cannot write and expired tokens never call RPC', async () => {
  const calls = stub();
  assert.equal((await call(null, create())).statusCode, 401);
  assert.equal((await call('Bearer invalid', append())).statusCode, 401);
  assert.equal(calls.filter(c => c.url.pathname.includes('/rpc/')).length, 0);
});

test('invalid UUID, role, payload, content and HTTP method fail before upstream', async () => {
  const calls = stub();
  const invalid = [
    { ...create(), id: 'bad-id' },
    { ...create(), title: '' },
    { ...append(), conversation_id: 'wrong' },
    { ...append(), message_id: [MESSAGE] },
    { ...append(), role: 'system' },
    { ...append(), content: { text: 'ok', secret: 'bad' } },
    { ...append(), content: { text: '' } },
    { ...append(), content: { text: 'x'.repeat(16001) } },
  ];
  for (const bad of invalid) assert.equal((await call('Bearer a', bad)).statusCode, 400);
  assert.equal((await call('Bearer a', create(), 'GET')).statusCode, 405);
  assert.equal(calls.length, 0);
});

test('foreign parent and absent parent share the same 404 response', async () => {
  stub({ errorCode: 'P0002' });
  const foreign = await call('Bearer b', append());
  const missing = await call('Bearer a', append('30000000-0000-4000-8000-000000000099'));
  assert.equal(foreign.statusCode, 404);
  assert.deepEqual(foreign.payload, missing.payload);
});

test('retry conflicts are explicit but SQL details and credentials are private', async () => {
  stub({ errorCode: '23505' });
  const result = await call('Bearer a', append());
  assert.equal(result.statusCode, 409);
  assert.equal(result.payload.code, 'CONVERSATION_ID_CONFLICT');
  assert.doesNotMatch(JSON.stringify(result.payload), /private SQL details|service_role/i);
});

test('provider failure and interrupted writes never claim persistence success', async () => {
  stub({ errorCode: 'PGRST202' });
  const unavailable = await call('Bearer a', append());
  assert.equal(unavailable.statusCode, 503);
  assert.match(unavailable.payload.error, /retry with the same message ID/i);
  stub({ failTransport: true });
  const interrupted = await call('Bearer a', append());
  assert.equal(interrupted.statusCode, 503);
  assert.equal(interrupted.payload.code, 'CONVERSATION_SAVE_UNAVAILABLE');
});
