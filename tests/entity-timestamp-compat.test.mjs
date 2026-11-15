import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyTimestampColumn, canRetryLegacyTimestamp } from '../src/lib/entity-timestamp-compat.mjs';

test('maps only the canonical timestamp columns', () => {
  assert.equal(legacyTimestampColumn('created_date'), 'created_at');
  assert.equal(legacyTimestampColumn('updated_date'), 'updated_at');
  assert.equal(legacyTimestampColumn('user_id'), null);
});

test('retries only missing timestamp columns, never permission or unrelated failures', () => {
  assert.equal(canRetryLegacyTimestamp({ code: '42703', message: 'column created_date does not exist' }, 'created_date'), true);
  assert.equal(canRetryLegacyTimestamp({ code: '42703', message: 'column updated_date does not exist' }, 'updated_date'), true);
  assert.equal(canRetryLegacyTimestamp({ code: '42501', message: 'permission denied on created_date' }, 'created_date'), false);
  assert.equal(canRetryLegacyTimestamp({ code: '42703', message: 'column user_id does not exist' }, 'created_date'), false);
  assert.equal(canRetryLegacyTimestamp({ code: '42703', message: 'column user_id does not exist' }, 'user_id'), false);
});
