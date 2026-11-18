import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyEyraConversationReadHttpFailure } from '../src/lib/eyra-cloud-history.mjs';

test('PostgREST missing-schema codes report history unavailable, not empty data', () => {
  for (const code of ['PGRST205', '42P01', 'PGRST202', '42883']) {
    const failure = classifyEyraConversationReadHttpFailure(404, {
      code, message: 'database SQL and private info MUST_NOT_LEAK',
    });
    assert.deepEqual(failure, {
      status: 503,
      code: 'EYRA_CLOUD_HISTORY_UNAVAILABLE',
      message: 'Cloud conversation history is not activated in this environment.',
    });
  }
});

test('RLS and permission denial cannot be disguised as schema absence', () => {
  for (const status of [401, 403]) {
    for (const code of ['42501', 'PGRST301', '', undefined]) {
      const failure = classifyEyraConversationReadHttpFailure(status, { code, details: 'SECRET' });
      assert.equal(failure.status, 403);
      assert.equal(failure.code, 'CONVERSATION_ACCESS_DENIED');
      assert.doesNotMatch(failure.message, /SECRET|SQL/);
    }
  }
});

test('Provider/network and malformed failures remain transient, never a false empty list', () => {
  for (const body of [null, { code: 'PGRST116' }, { code: 'XX000' }, { error: 'sensitive' }]) {
    assert.deepEqual(classifyEyraConversationReadHttpFailure(503, body), {
      status: 503,
      code: 'CONVERSATION_SERVICE_UNAVAILABLE',
      message: 'Conversation history is temporarily unavailable.',
    });
  }
});

test('Hosted read endpoint propagates safe classification without SQL disclosure', () => {
  const source = readFileSync(new URL('../api/eyra-conversations.js', import.meta.url), 'utf8');
  assert.match(source, /classifyEyraConversationReadHttpFailure\(result\.status, failureBody\)/);
  assert.match(source, /error\?\.code === 'EYRA_CLOUD_HISTORY_UNAVAILABLE'/);
  assert.match(source, /error\?\.code === 'CONVERSATION_ACCESS_DENIED'/);
  assert.match(source, /response\.setHeader\('Cache-Control', 'private, no-store'\)/);
  assert.doesNotMatch(source, /response\.status\(.*\)\.json\(.*failureBody/);
});
