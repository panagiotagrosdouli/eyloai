import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const project = path.resolve(process.argv[2] || '');
const runnerTemp = path.resolve(process.env.RUNNER_TEMP || '');
if (!runnerTemp || !project.startsWith(`${runnerTemp}${path.sep}`) || project === repoRoot) {
  throw new Error('Local Supabase project must be a disposable child of RUNNER_TEMP.');
}
const configPaths = ['supabase/config.jsonc', 'supabase/config.toml'];
let configFound = false;
for (const config of configPaths) {
  try { await readFile(path.join(project, config)); configFound = true; break; } catch {}
}
if (!configFound) throw new Error('supabase init did not create a local CLI config.');

const plan = JSON.parse(await readFile(path.join(repoRoot, 'supabase/migration-review-plan.json'), 'utf8'));
const expected = new Map(plan.files.map(row => [row.name, row.sha256]));
const migrationDir = path.join(project, 'supabase/migrations');
await mkdir(migrationDir, { recursive: true });
for (const entry of await (await import('node:fs/promises')).readdir(migrationDir)) {
  if (entry.endsWith('.sql')) await import('node:fs/promises').then(fs => fs.rm(path.join(migrationDir, entry), { force: true }));
}
const applied = [];
for (const [index, name] of plan.canonical_local_order.entries()) {
  const source = path.join(repoRoot, 'supabase/migrations', name);
  const sql = await readFile(source);
  const digest = createHash('sha256').update(sql).digest('hex');
  if (expected.get(name) !== digest) throw new Error(`Migration fingerprint changed: ${name}`);
  // Unique chronological versions preserve the reviewed order, including legacy duplicate timestamps.
  const version = `20261128${String(index + 1).padStart(6, '0')}`;
  const label = name.replace(/^\d+_/, '').replace(/\.sql$/, '');
  const destination = `${version}_${label}.sql`;
  await cp(source, path.join(migrationDir, destination));
  applied.push({ source: name, version, sha256: digest });
}
await writeFile(path.join(project, 'reviewed-migration-replay.json'), `${JSON.stringify(applied, null, 2)}\n`);
console.log(`Prepared ${applied.length} SHA-verified canonical migrations in a disposable CLI project.`);
