import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePendingEyraUserMessage,
  saveEyraUserMessage,
  eyraPersistenceStatus,
} from '../src/lib/eyra-conversation-saving.mjs';

const conversationId = '10000000-0000-4000-8000-000000000001';
const messageId = '20000000-0000-4000-8000-000000000001';
const ownerA = '00000000-0000-4000-8000-000000000001';
const ownerB = '00000000-0000-4000-8000-000000000002';

function message() {
  return makePendingEyraUserMessage('My research question', conversationId, 1234, () => messageId);
}
function mockTransport({ failAt = '', invalidAck = false } = {}) {
  const calls = [];
  async function fetchImpl(path, options) {
    assert.equal(path, '/api/eyra-conversation-write');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer owner-a-token');
    const payload = JSON.parse(options.body);
    calls.push(payload);
    if (failAt === payload.action) throw new TypeError('Connection lost after request');
    if (payload.action === 'create') {
      return Response.json({ conversation: { id: invalidAck ? ownerB : payload.id } });
    }
    return Response.json({ message: {
      id: invalidAck ? ownerB : payload.message_id,
      conversation_id: payload.conversation_id,
      sequence_number: 1,
      role: payload.role,
      content: payload.content,
    } });
  }
  return { calls, fetchImpl };
}
const authenticated = async () => ({ access_token: 'owner-a-token', user: { id: ownerA } });

test('stable conversation and message UUIDs survive the retry boundary', async () => {
  const item = message();
  assert.equal(item.id, messageId);
  assert.equal(item.conversationId, conversationId);
  assert.equal(item.persistence, 'saving');
  const { calls, fetchImpl } = mockTransport();
  const saved1 = await saveEyraUserMessage(item, { getSession: authenticated, fetchImpl });
  const saved2 = await saveEyraUserMessage(item, { getSession: authenticated, fetchImpl });
  assert.equal(saved1.id, messageId);
  assert.deepEqual(saved1, saved2);
  assert.deepEqual(calls.map(call => call.action), ['create', 'append', 'create', 'append']);
  assert.deepEqual(calls.filter(call => call.action === 'append').map(call => call.message_id), [messageId, messageId]);
  assert.deepEqual(calls.filter(call => call.action === 'create').map(call => call.id), [conversationId, conversationId]);
});

test('saved means both the conversation and message returned matching server acknowledgements', async () => {
  const { fetchImpl } = mockTransport();
  const owners = [];
  const saved = await saveEyraUserMessage(message(), {
    getSession: authenticated, fetchImpl,
    onIdentity: id => owners.push(id),
  });
  assert.deepEqual(owners, [ownerA]);
  assert.equal(saved.sequence_number, 1);
  await assert.rejects(
    saveEyraUserMessage(message(), {
      getSession: authenticated, fetchImpl: mockTransport({ invalidAck: true }).fetchImpl,
    }),
    /not confirmed/i,
  );
  assert.equal(eyraPersistenceStatus(new Error('not confirmed')), 'unconfirmed');
});

test('authenticated owner check stops cross-account message retries before network', async () => {
  const m = { ...message(), ownerId: ownerA };
  const { calls, fetchImpl } = mockTransport();
  await assert.rejects(saveEyraUserMessage(m, {
    getSession: async () => ({ access_token: 'owner-b-token', user: { id: ownerB } }),
    fetchImpl,
  }), error => error.code === 'EYRA_OWNER_MISMATCH');
  assert.equal(calls.length, 0);
  assert.equal(eyraPersistenceStatus({ code: 'EYRA_OWNER_MISMATCH' }), 'failed');
});

test('unauthenticated sessions remain local only and never call write API', async () => {
  const { calls, fetchImpl } = mockTransport();
  await assert.rejects(saveEyraUserMessage(message(), {
    getSession: async () => null, fetchImpl,
  }), error => {
    assert.equal(error.code, 'EYRA_LOCAL_ONLY');
    assert.equal(eyraPersistenceStatus(error), 'local-only');
    return true;
  });
  assert.equal(calls.length, 0);
});

test('network interruption on create or append stays unconfirmed and uses same IDs on retry', async () => {
  const item = message();
  for (const step of ['create', 'append']) {
    const network = mockTransport({ failAt: step });
    await assert.rejects(
      saveEyraUserMessage(item, { getSession: authenticated, fetchImpl: network.fetchImpl }),
      /Connection lost/,
    );
    assert.equal(eyraPersistenceStatus(new TypeError('Network')), 'unconfirmed');
    const healthy = mockTransport();
    const result = await saveEyraUserMessage(item, { getSession: authenticated, fetchImpl: healthy.fetchImpl });
    assert.equal(result.id, item.id);
    assert.equal(healthy.calls[0].id, item.conversationId);
    assert.equal(healthy.calls[1].message_id, item.id);
  }
});

test('server denial becomes failed, server unavailability stays unconfirmed', async () => {
  for (const status of [400, 401, 404, 409, 503, 504]) {
    const fetchImpl = async () => Response.json({ error: 'do not expose SQL', code: 'TEST' }, { status });
    const item = message();
    const error = await saveEyraUserMessage(item, { getSession: authenticated, fetchImpl })
      .then(() => null, e => e);
    assert.ok(error);
    assert.equal(eyraPersistenceStatus(error), status >= 500 ? 'unconfirmed' : 'failed');
    assert.doesNotMatch(error.message, /SQL/);
  }
});

test('invalid user messages are never transmitted', async () => {
  const { calls, fetchImpl } = mockTransport();
  const bad = [
    { ...message(), id: 'bad' },
    { ...message(), role: 'assistant' },
    { ...message(), content: ' ' },
    { ...message(), conversationId: 'invalid' },
  ];
  for (const item of bad) {
    await assert.rejects(saveEyraUserMessage(item, { getSession: authenticated, fetchImpl }), /Invalid message/);
  }
  assert.equal(calls.length, 0);
});
