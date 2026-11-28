import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectDir = path.resolve(process.env.LOCAL_SUPABASE_PROJECT_DIR || '');
const runnerTemp = path.resolve(process.env.RUNNER_TEMP || '');
if (!runnerTemp || !projectDir.startsWith(`${runnerTemp}${path.sep}`)) {
  throw new Error('The schema preflight is restricted to a disposable local Supabase project.');
}
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'SUPABASE_URL']) {
  if (process.env[key]) throw new Error(`Remote Supabase variable ${key} is forbidden in this test.`);
}

const sql = await readFile(path.join(repoRoot, 'supabase/recovery/scholarly_provider_coordination_preflight.sql'), 'utf8');
const output = execFileSync('docker', [
  'exec', '-i', `supabase_db_${path.basename(projectDir)}`,
  'psql', '-XAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '-',
], { input: sql, encoding: 'utf8' }).trim();
const report = JSON.parse(output);

assert.equal(report.migration_version, '20261128145000');
assert.equal(report.migration_recorded, true, 'the exact recovery version must be present in the disposable migration ledger');
assert.equal(report.overall, 'RECORDED_REVIEW_FUNCTION_BODIES_AND_CATALOG_CONTRACTS');
assert.equal(report.table_objects.length, 3);
for (const table of report.table_objects) {
  assert.equal(table.status, 'PRESENT_REQUIRES_DEFINITION_REVIEW', `${table.name} should pass structural/security checks`);
}
assert.equal(report.rpc_objects.length, 4);
for (const routine of report.rpc_objects) {
  assert.equal(routine.status, 'SIGNATURE_SECURITY_GRANTS_COMPATIBLE_BODY_REVIEW_REQUIRED', `${routine.name} should pass signature/security/grant checks`);
}
console.log('PASS: read-only preflight confirms the exact disposable migration version, tables, RPC signatures, RLS, and grants.');
