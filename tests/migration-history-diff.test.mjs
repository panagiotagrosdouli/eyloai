import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
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
  const ambiguous = compareMigrationHistory([], ['20261115185428_a.sql', '20261115185428_b.sql']);
  assert.equal(ambiguous.remote_history_verified, false);
  assert.deepEqual(ambiguous.ambiguous_local_versions, [{
    version: '20261115185428',
    files: ['20261115185428_a.sql', '20261115185428_b.sql'],
  }]);
  assert.throws(() => compareMigrationHistory([{ version: 'abc' }], []), /Invalid/);
});

test('real migration directory yields a useful fail-closed report for legacy 20260803 prefixes', () => {
  const local = readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .filter(name => name.endsWith('.sql'));
  const result = compareMigrationHistory([{ version: '20261115185428' }], local);
  assert.ok(result.local_count >= 33);
  assert.equal(result.remote_history_verified, false);
  assert.ok(result.remote_only_versions.includes('20261115185428'));
  assert.deepEqual(result.ambiguous_local_versions.find(item => item.version === '20260803')?.files, [
    '20260803_eylo_core_entities.sql',
    '20260803_eylo_monitoring_entities.sql',
  ]);
  assert.equal(result.remote_application_authorized, false);
});

test('a duplicate exact match is never reported as verified', () => {
  const result = compareMigrationHistory(
    [{ version: '20261115185428' }],
    ['20261115185428_a.sql', '20261115185428_b.sql'],
  );
  assert.deepEqual(result.matching_versions, []);
  assert.deepEqual(result.remote_only_versions, []);
  assert.equal(result.remote_history_verified, false);
});
