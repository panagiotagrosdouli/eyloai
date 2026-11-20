import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessLegacyProfileReplay } from '../scripts/integration/legacy-profile-replay-guard.mjs';

const get = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const evidence = {
  legacyBootstrap: get('tests/integration/legacy-schema-bootstrap.sql'),
  hardeningSql: get('supabase/migrations/20260817090500_security_hardening.sql'),
  bridgeSql: get('supabase/migrations/20261115190203_bridge_legacy_workspace_schema.sql'),
  fingerprints: JSON.parse(get('docs/release/supabase-applied-sql-fingerprints-2026-11-20.json')),
};

test('reject historical security SQL replay before the profile owner bridge', () => {
  const result = assessLegacyProfileReplay(evidence);
  assert.equal(result.legacy_profile_has_user_id, false);
  assert.equal(result.remote_application_authorized, false);
  assert.equal(result.historical_replay_safe, false);
  assert.equal(result.review_required, true);
  assert.deepEqual(result.risks, ['local_security_sql_references_column_missing_in_legacy_schema']);
});

test('refuse history approval if fingerprint review or owner bridge changes', () => {
  const changed = {
    ...evidence,
    fingerprints: {items: evidence.fingerprints.items.map(row =>
      row.remote_name === 'security_hardening' ? {...row, classification: 'exact_sql_match'} : row)},
  };
  assert.throws(() => assessLegacyProfileReplay(changed), /independently classified/);
  const broken = assessLegacyProfileReplay({...evidence, bridgeSql: 'select 1'});
  assert.ok(broken.risks.includes('owner_bridge_invariant_unverified'));
  assert.equal(broken.historical_replay_safe, false);
});

test('fail closed on unrecognized historical profile schema', () => {
  assert.throws(() => assessLegacyProfileReplay({...evidence, legacyBootstrap: ''}), /not available/);
});
