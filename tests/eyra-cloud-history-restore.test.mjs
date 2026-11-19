import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('cloud history selects the newest 30 turns and restores chronological display order', () => {
  // A conversation of 35 turns must reopen at turns 6..35, not 1..30.
  const persisted = Array.from({ length: 35 }, (_, i) => ({
    ...validRow,
    role: 'user',
    content: { text: 'Turn ' + (i + 1) },
    created_date: new Date(Date.UTC(2026, 10, 19, 12, i)).toISOString(),
    sequence_number: i + 1,
  }));
  const databaseNewestFirst = persisted.slice().reverse().slice(0, 30);
  const restored = restoreEyraConversationMessages(databaseNewestFirst.slice().reverse());
  assert.equal(restored.length, 30);
  assert.equal(restored[0].content, 'Turn 6');
  assert.equal(restored.at(-1).content, 'Turn 35');

  const source = readFileSync(new URL('../src/lib/eyra-history.js', import.meta.url), 'utf8');
  assert.match(source, /order\('sequence_number', \{ ascending: false \}\)\.limit\(30\)/);
  assert.match(source, /restoreEyraConversationMessages\(Array\.isArray\(rows\) \? rows\.slice\(\)\.reverse\(\) : rows\)/);
});
