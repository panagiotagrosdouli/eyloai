import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifySupabaseReconciliationManifest(manifest, root) {
  const errors = [];
  const migrationsDir = resolve(root, 'supabase/migrations');
  const fingerprintPath = resolve(root, 'docs/release', manifest?.prior_sql_fingerprint_manifest || '');
  const fingerprints = JSON.parse(readFileSync(fingerprintPath, 'utf8'));
  const migrationFiles = readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
  const pendingMigrations = Array.isArray(manifest?.pending_local_migrations) ? manifest.pending_local_migrations : [];
  if (manifest?.schema_version !== 1) errors.push('invalid_schema_version');
  if (manifest?.project_ref !== fingerprints.project_ref) errors.push('project_reference_mismatch');
  if (migrationFiles.length !== manifest?.local_migration_files + pendingMigrations.length) errors.push('local_migration_count_changed');

  for (const item of pendingMigrations) {
    if (typeof item?.name !== 'string' || !/^\d{14}_[a-z0-9_]+\.sql$/i.test(item.name)) {
      errors.push('unsafe_pending_migration_name');
      continue;
    }
    if (item.applied_to_observed_project !== false) errors.push('pending_migration_marked_applied');
    if ((manifest?.applied_migration_versions || []).includes(item.name.slice(0, 14))) errors.push('pending_migration_in_applied_inventory');
    if (!migrationFiles.includes(item.name)) {
      errors.push('missing_pending_migration:' + item.name);
      continue;
    }
    const digest = createHash('sha256').update(readFileSync(resolve(migrationsDir, item.name))).digest('hex');
    if (digest !== item.sha256) errors.push('pending_migration_hash_changed:' + item.name);
  }

  let exact = 0;
  let divergent = 0;
  for (const item of fingerprints.items || []) {
    const file = resolve(migrationsDir, item.local_file);
    let digest = '';
    try { digest = createHash('md5').update(readFileSync(file)).digest('hex'); }
    catch { errors.push('missing_local_migration:' + item.local_file); continue; }
    if (digest === item.remote_md5) exact += 1;
    else if (item.classification === 'divergent_sql_requires_review') divergent += 1;
    else errors.push('unexpected_local_sql_drift:' + item.local_file);
  }
  if (exact !== manifest?.prior_fingerprint_results?.exact_sql_matches) errors.push('exact_sql_match_count_changed');
  if (divergent !== manifest?.prior_fingerprint_results?.divergent_sql_matches) errors.push('divergent_sql_count_changed');
  const versions = manifest?.applied_migration_versions || [];
  if (versions.length !== 19 || new Set(versions).size !== versions.length || versions.some(version => !/^\d{14}$/.test(version))) errors.push('invalid_applied_version_inventory');
  if (manifest?.remote_public_table_count !== 34 || manifest?.remote_public_tables_with_rls_enabled !== 34) errors.push('observed_schema_snapshot_changed');
  if (manifest?.staging?.branch_status !== 'MIGRATIONS_FAILED' || manifest?.release_decision !== 'NO-GO') errors.push('unsafe_release_or_staging_status');
  return { valid: errors.length === 0, errors, local_migration_files: migrationFiles.length, pending_local_migrations: pendingMigrations.length, prior_fingerprints_checked: exact + divergent, exact_sql_matches: exact, known_divergences: divergent };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/release/supabase-reconciliation-2026-11-28.json'), 'utf8'));
  const result = verifySupabaseReconciliationManifest(manifest, root);
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 2;
}
