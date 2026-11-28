import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const planPath = join(root, 'supabase/migration-review-plan.json');
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const workdir = await mkdtemp(join(tmpdir(), 'eylo-supabase-acceptance-'));
const localProjectDir = join(workdir, 'supabase');
const migrationsDir = join(localProjectDir, 'migrations');
let started = false;

if (!Array.isArray(plan.canonical_local_order) || plan.remote_application_authorized !== false) {
  throw new Error('Refusing Supabase acceptance without the canonical non-remote migration manifest.');
}
await mkdir(migrationsDir, { recursive: true });
await cp(join(root, 'supabase/config.toml'), join(localProjectDir, 'config.toml'));

// The repository contains historical filenames whose lexical order differs from
// the reviewed replay order. Copy exact sources under sequential local-only IDs;
// never change or write migration history in the repository or a hosted project.
for (let index = 0; index < plan.canonical_local_order.length; index += 1) {
  const sourceName = plan.canonical_local_order[index];
  if (typeof sourceName !== 'string' || sourceName.includes('/') || sourceName.includes('..')) {
    throw new Error('Unsafe migration path in canonical manifest.');
  }
  const source = join(root, 'supabase/migrations', sourceName);
  const sql = await readFile(source);
  const shortName = sourceName.replace(/^\d+_/, '').replace(/\.sql$/, '');
  const localVersion = String(20261128000000 + index + 1);
  await writeFile(join(migrationsDir, `${localVersion}_${shortName}.sql`), sql);
}

async function runSupabase(args, { capture = false } = {}) {
  try {
    const result = await execFileAsync('supabase', ['--workdir', workdir, ...args], {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 35 * 60 * 1000,
      env: { ...process.env, SUPABASE_YES: '1' },
    });
    return capture ? result.stdout : '';
  } catch {
    // CLI output can contain local API keys. Do not print or surface raw output.
    throw new Error(`Supabase CLI ${args[0]} failed; inspect the action's sanitized service logs.`);
  }
}

try {
  started = true;
  await runSupabase(['start']);
  const status = await runSupabase(['status', '-o', 'env'], { capture: true });
  const values = Object.fromEntries(status.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return [];
    const value = match[2].replace(/^['"]|['"]$/g, '');
    return [[match[1], value]];
  }));
  const localUrl = values.API_URL;
  const publicKey = values.ANON_KEY;
  const serviceKey = values.SERVICE_ROLE_KEY;
  if (!localUrl || !publicKey || !serviceKey || !/^http:\/\/127\.0\.0\.1:54321$/.test(localUrl)) {
    throw new Error('Supabase local stack did not report the expected isolated API endpoint and keys.');
  }

  console.log('Local Supabase CLI stack started: PostgreSQL, Auth, Storage, PostgREST and Realtime.');
  const integration = await execFileAsync(process.execPath, ['tests/integration/supabase-two-account.mjs'], {
    cwd: root,
    timeout: 5 * 60 * 1000,
    env: {
      ...process.env,
      EYLO_ENVIRONMENT: 'test',
      VITE_SUPABASE_URL: localUrl,
      VITE_SUPABASE_ANON_KEY: publicKey,
      SUPABASE_URL: localUrl,
      SUPABASE_ANON_KEY: publicKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (integration.stdout.trim()) process.stdout.write(integration.stdout);
} finally {
  if (started) {
    try { await runSupabase(['stop', '--no-backup']); }
    catch { console.error('Supabase CLI stop failed; GitHub Actions runner cleanup will discard the disposable stack.'); }
  }
  await rm(workdir, { recursive: true, force: true });
}
