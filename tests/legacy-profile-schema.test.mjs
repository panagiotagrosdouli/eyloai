import test from 'node:test';
import assert from 'node:assert/strict';
import { isLegacyProfileShapeError, normalizeLegacyProfileWrite } from '../src/lib/legacy-profile-schema.mjs';

test('only missing canonical columns permit the legacy profiles path', () => {
  assert.equal(isLegacyProfileShapeError({ code: '42703', message: 'column profiles.user_id does not exist' }), true);
  assert.equal(isLegacyProfileShapeError({ code: 'PGRST204', message: "Could not find the 'data' column of 'profiles' in the schema cache" }), true);
  assert.equal(isLegacyProfileShapeError({ code: '42501', message: 'permission denied for profiles' }), false);
  assert.equal(isLegacyProfileShapeError({ code: 'PGRST204', message: 'Could not find unrelated column' }), false);
  assert.equal(isLegacyProfileShapeError(null), false);
});

test('normalize legacy write into canonical success contract', () => {
  assert.deepEqual(normalizeLegacyProfileWrite({ data: { full_name: 'Example' }, error: null }).data,
    { data: { full_name: 'Example' } });
  assert.equal(normalizeLegacyProfileWrite({ data: null, error: null }).data, null);
  const failure = { data: null, error: { code: '42501' } };
  assert.strictEqual(normalizeLegacyProfileWrite(failure), failure);
});
