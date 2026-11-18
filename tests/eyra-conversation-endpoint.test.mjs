import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra-conversations.js';

const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const SECRET = 'SQL trace and private email SHOULD_NOT_LEAK';

function makeResponse() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function json(status, data) {
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => data,
  };
}

async function invoke(dbStatus, dbCode, authOk = true) {
  const oldUrl = process.env.VITE_SUPABASE_URL;
  const oldKey = process.env.VITE_SUPABASE_ANON_KEY;
  const oldFetch = globalThis.fetch;
  process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'public-test-key';
  let dbCalled = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.authorization, 'Bearer fixture-token');
    assert.ok(String(url).startsWith('https://test-project.supabase.co/'));
    if (String(url).includes('/auth/v1/user')) {
      return json(authOk ? 200 : 401, authOk ? { id: OWNER } : { message: SECRET });
    }
    dbCalled = true;
    return json(dbStatus, dbStatus === 200
      ? [] : { code: dbCode, message: SECRET, details: SECRET });
  };
  const response = makeResponse();
  try {
    await handler({
      method: 'GET', headers: { authorization: 'Bearer fixture-token' },
      query: {},
    }, response);
    return { response, dbCalled };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = oldKey;
  }
}

test('hosted missing table returns explicit 503 unavailable, not an empty history', { concurrency: false }, async () => {
  for (const code of ['PGRST205', '42P01']) {
    const { response, dbCalled } = await invoke(404, code);
    assert.ok(dbCalled);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'EYRA_CLOUD_HISTORY_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(response.body), /SHOULD_NOT_LEAK/);
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
  }
});

test('permission failures cannot pretend cloud history is unconfigured', { concurrency: false }, async () => {
  const { response } = await invoke(403, '42501');
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'CONVERSATION_ACCESS_DENIED');
  assert.doesNotMatch(JSON.stringify(response.body), /SHOULD_NOT_LEAK/);
});

test('upstream temporary failures and truly empty history stay distinct', { concurrency: false }, async () => {
  const outage = await invoke(503, 'XX000');
  assert.equal(outage.response.statusCode, 503);
  assert.equal(outage.response.body.code, 'CONVERSATION_SERVICE_UNAVAILABLE');
  const empty = await invoke(200);
  assert.equal(empty.response.statusCode, 200);
  assert.deepEqual(empty.response.body.conversations, []);
});

test('invalid session never requests private database history', { concurrency: false }, async () => {
  const { response, dbCalled } = await invoke(200, undefined, false);
  assert.equal(response.statusCode, 401);
  assert.equal(dbCalled, false);
});
