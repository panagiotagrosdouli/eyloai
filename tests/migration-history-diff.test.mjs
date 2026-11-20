import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMigrationHistory } from '../scripts/integration/migration-history-diff.mjs';

test('remote-only and local-only migration versions are reported without SQL', () => {
  const result = compareMigrationHistory(
    [{ version: '20261115185428' }, { version: '20261115191303' }],
    ['20261113113010_shared_discovery_quota.sql', '20261115190203_bridge_legacy_workspace_schema.sql'],
  );
  assert.equal(result.remote_count, 2);
  assert.equal(result.local_count, 2);
  assert.deepEqual(result.remote_only_versions, ['20261115185428', '20261115191303']);
  assert.equal(result.remote_history_verified, false);
  assert.equal(result.remote_application_authorized, false);
  assert.equal('sql' in result, false);
});

test('only exact version matches pass the preflight', () => {
  const result = compareMigrationHistory(
    [{ version: '20261115185428' }],
    ['20261115185428_shared_discovery_quota.sql'],
  );
  assert.equal(result.remote_history_verified, true);
  assert.deepEqual(result.remote_only_versions, []);
  assert.equal(result.remote_application_authorized, false);
});

test('invalid or ambiguous inventories fail closed', () => {
  assert.throws(() => compareMigrationHistory(['20261115185428', '20261115185428'], []), /duplicate/);
  assert.throws(() => compareMigrationHistory(['20261115185428'], ['../bad.sql']), /Invalid/);
  assert.throws(() => compareMigrationHistory([], ['20261115185428_a.sql', '20261115185428_b.sql']), /Duplicate/);
  assert.throws(() => compareMigrationHistory([{ version: 'abc' }], []), /Invalid/);
});
