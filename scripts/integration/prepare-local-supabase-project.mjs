import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const project = path.resolve(process.argv[2] || '');
const runnerTemp = path.resolve(process.env.RUNNER_TEMP || '');
if (!runnerTemp || !project.startsWith(`${runnerTemp}${path.sep}`) || project === repoRoot) {
  throw new Error('Local Supabase project must be a disposable child of RUNNER_TEMP.');
}
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'SUPABASE_URL']) {
  if (process.env[key]) throw new Error(`Remote Supabase variable ${key} is forbidden in local stack setup.`);
}
const review = JSON.parse(execFileSync('node', ['scripts/review-migration-plan.mjs'], { cwd: repoRoot, encoding: 'utf8' }));
if (review.local_plan_verified !== true || review.remote_application_authorized !== false || review.issues?.length) {
  throw new Error('The reviewed canonical migration plan is not safe for disposable replay.');
}
const configPaths = ['supabase/config.jsonc', 'supabase/config.toml'];
let configFound = false;
for (const config of configPaths) {
  try { await readFile(path.join(project, config)); configFound = true; break; } catch {}
}
if (!configFound) throw new Error('supabase init did not create a local CLI config.');
try {
  await readFile(path.join(project, 'supabase/.temp/project-ref'));
  throw new Error('The temporary Supabase project must remain unlinked.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const plan = JSON.parse(await readFile(path.join(repoRoot, 'supabase/migration-review-plan.json'), 'utf8'));
const expected = new Map(plan.files.map(row => [row.name, row.sha256]));
const coordinationMigration = '20261128145000_scholarly_provider_coordination.sql';
const coordinationIndex = plan.canonical_local_order.indexOf(coordinationMigration);
if (coordinationIndex < 0) throw new Error('The reviewed plan omits the scholarly coordination migration.');
const deferCoordination = process.argv.includes('--defer-scholarly-coordination');
const replayOrder = deferCoordination
  ? plan.canonical_local_order.filter(name => name !== coordinationMigration)
  : plan.canonical_local_order;
const migrationDir = path.join(project, 'supabase/migrations');
await mkdir(migrationDir, { recursive: true });
for (const entry of await readdir(migrationDir)) {
  if (entry.endsWith('.sql')) await rm(path.join(migrationDir, entry), { force: true });
}
const applied = [];
for (const [index, name] of replayOrder.entries()) {
  const source = path.join(repoRoot, 'supabase/migrations', name);
  const sql = await readFile(source);
  const digest = createHash('sha256').update(sql).digest('hex');
  if (expected.get(name) !== digest) throw new Error(`Migration fingerprint changed: ${name}`);
  // Keep the recovery migration's exact version for the catalog preflight; assign
  // unique surrounding versions so the full replay remains in reviewed order.
  const version = deferCoordination
    ? `20261128${String(index + 1).padStart(6, '0')}`
    : index < coordinationIndex
    ? `20261128${String(index + 1).padStart(6, '0')}`
    : index === coordinationIndex
      ? '20261128145000'
      : `20261128${String(145000 + index - coordinationIndex).padStart(6, '0')}`;
  const label = name.replace(/^\d+_/, '').replace(/\.sql$/, '');
  const destination = `${version}_${label}.sql`;
  await cp(source, path.join(migrationDir, destination));
  applied.push({ source: name, version, sha256: digest });
}
const replayVersions = applied.map(row => row.version);
if ((!deferCoordination && applied[coordinationIndex]?.version !== '20261128145000')
  || (deferCoordination && applied.some(row => row.source === coordinationMigration))
  || replayVersions.some((version, index) => index > 0 && version <= replayVersions[index - 1])) {
  throw new Error('The disposable replay must preserve ordered migrations and defer or preserve the exact scholarly recovery version.');
}
await writeFile(path.join(project, 'reviewed-migration-replay.json'), `${JSON.stringify(applied, null, 2)}\n`);
console.log(`Prepared ${applied.length} SHA-verified canonical migrations in a disposable CLI project${deferCoordination ? ' with scholarly coordination deferred for exact recovery acceptance' : ''}.`);
