import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/meeting-room.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function setMeetingEnv({ livekit = true } = {}) {
  process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
  process.env.SUPABASE_SECRET_KEY = 'server-test-key';
  if (livekit) {
    process.env.LIVEKIT_URL = 'wss://media.example.test';
    process.env.LIVEKIT_API_KEY = 'test-api-key';
    process.env.LIVEKIT_API_SECRET = 'test-api-secret';
  } else {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  }
}

test('meeting API fails closed when LiveKit is not configured', async () => {
  setMeetingEnv({ livekit: false });
  const response = responseRecorder();
  await handler({ method: 'POST', headers: {}, body: { action: 'start', meetingId: '123e4567-e89b-12d3-a456-426614174000' } }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'LIVEKIT_NOT_CONFIGURED');
});

test('meeting API rejects unauthenticated users before reading meeting membership', async () => {
  setMeetingEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    const response = responseRecorder();
    await handler({ method: 'POST', headers: { authorization: 'Bearer expired' }, body: { action: 'join', meetingId: '123e4567-e89b-12d3-a456-426614174000' } }, response);
    assert.equal(response.statusCode, 401);
    assert.match(response.body.error, /sign in/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a different authenticated account cannot join without accepted membership', async () => {
  setMeetingEnv();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'attacker-id', email: 'attacker@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' }), { status: 200 });
    if (url.includes('/rest/v1/meetings?')) return new Response(JSON.stringify([{ id: '123e4567-e89b-12d3-a456-426614174000', user_id: 'owner-id', data: { native_status: 'live' } }]), { status: 200 });
    if (url.includes('/rest/v1/meeting_participants?')) return new Response('[]', { status: 200 });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const response = responseRecorder();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-test-token' }, body: { action: 'join', meetingId: '123e4567-e89b-12d3-a456-426614174000' } }, response);
    assert.equal(response.statusCode, 403);
    assert.match(response.body.error, /not an invited participant/i);
    assert.equal(calls.some(url => url.includes('/auth/v1/user')), true);
    assert.equal(calls.some(url => url.includes('/rest/v1/meeting_participants?')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
