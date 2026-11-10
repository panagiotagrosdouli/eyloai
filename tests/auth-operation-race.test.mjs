import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldApplyAuthResult } from '../src/lib/auth/authOperation.js';

test('auth operation results are accepted only for the current mounted generation', () => {
  assert.equal(shouldApplyAuthResult(2, 2, true), true);
  assert.equal(shouldApplyAuthResult(2, 3, true), false);
  assert.equal(shouldApplyAuthResult(2, 2, false), false);
});
