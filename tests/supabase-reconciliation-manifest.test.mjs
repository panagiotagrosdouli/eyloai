import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifySupabaseReconciliationManifest } from '../scripts/verify-supabase-reconciliation-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = new URL('../docs/release/supabase-reconciliation-2026-11-28.json', import.meta.url);
const manifest = JSON.parse(readFileSync(path, 'utf8'));

test('read-only Supabase reconciliation snapshot matches local migration count and historical SQL fingerprints', () => {
  const result = verifySupabaseReconciliationManifest(manifest, root);
  assert.equal(result.valid, true, result.errors.join(', '));
  assert.equal(result.local_migration_files, 34);
  assert.equal(result.prior_fingerprints_checked, 19);
  assert.equal(result.exact_sql_matches, 18);
  assert.equal(result.known_divergences, 1);
});

test('reconciliation refuses to imply staging or production release approval', () => {
  const altered = structuredClone(manifest);
  altered.staging.branch_status = 'READY';
  altered.release_decision = 'GO';
  assert.equal(verifySupabaseReconciliationManifest(altered, root).valid, false);
});
