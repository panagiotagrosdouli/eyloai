import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreEyraConversationMessages } from '../src/lib/eyra-cloud-history-restore.mjs';

const validRow = {
  role: 'assistant',
  content: { text: 'The source is worth checking.' },
  sources: [],
  created_date: '2026-11-19T12:00:00Z',
};

test('restores validated saved messages in original sequence', () => {
  const result = restoreEyraConversationMessages([
    { ...validRow, role: 'user', content: { text: 'Find evidence' } },
    validRow,
  ]);
  assert.deepEqual(result.map(x => x.role), ['user', 'eyra']);
  assert.deepEqual(result.map(x => x.content), ['Find evidence', 'The source is worth checking.']);
  assert.equal(result[1].timestamp, Date.parse(validRow.created_date));
});

test('rejects malformed database envelopes without exposing private content', () => {
  for (const rows of [null, {}, 'invalid', [null], [{ ...validRow, content: null }],
    [{ ...validRow, role: 'system' }], [{ ...validRow, sources: {} }],
    [{ ...validRow, created_date: 'invalid' }]]) {
    assert.throws(() => restoreEyraConversationMessages(rows), error => {
      assert.doesNotMatch(error.message, /secret|SQL|undefined|Cannot read properties/i);
      return true;
    });
  }
});

test('invalid citations fail closed rather than displaying unsupported evidence', () => {
  assert.throws(() => restoreEyraConversationMessages([{
    ...validRow, content: { text: 'Claim [P1] not backed by saved sources.' }, sources: [],
  }]), /could not be verified/);
});
