import assert from 'node:assert/strict';
import test from 'node:test';
import { readOptionalEyraMessages } from '../src/lib/memory-source-availability.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

test('a missing optional EYRA history table does not block Notes/Projects Memory sources', () => {
  for (const code of ['PGRST205', '42P01']) {
    assert.deepEqual(
      readOptionalEyraMessages({ data: null, error: { code, message: 'relation unavailable' } }, owner),
      { records: [], historyAvailable: false },
    );
  }
});

test('owner-matched EYRA message records remain searchable when configured', () => {
  const rows = [{ id: 'message-1', user_id: owner, content: 'private research notes' }];
  assert.deepEqual(
    readOptionalEyraMessages({ data: rows, error: null }, owner),
    { records: rows, historyAvailable: true },
  );
});

test('permission errors and provider failures must not silently become empty results', () => {
  for (const code of ['42501', 'PGRST301', 'PGRST116', '57014']) {
    const error = { code, message: 'Request failed' };
    assert.throws(() => readOptionalEyraMessages({ error, data: null }, owner), error);
  }
});

test('ownership and malformed response checks remain strict', () => {
  assert.throws(
    () => readOptionalEyraMessages({ data: [{ user_id: other }], error: null }, owner),
    /ownership mismatch/i,
  );
  assert.throws(
    () => readOptionalEyraMessages({ data: null, error: null }, owner),
    /invalid response/i,
  );
  assert.throws(
    () => readOptionalEyraMessages({ data: [], error: null }, ''),
    /ownership mismatch/i,
  );
});
