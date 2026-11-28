import { appendFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const project = process.env.LOCAL_SUPABASE_PROJECT_DIR;
const githubEnv = process.env.GITHUB_ENV;
if (!project || !githubEnv) throw new Error('Missing ephemeral CI environment paths.');
const output = execFileSync('supabase', ['status', '--output', 'env'], { cwd: project, encoding: 'utf8' });
const values = new Map();
for (const line of output.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ''));
}
const apiUrl = values.get('API_URL');
const publishable = values.get('PUBLISHABLE_KEY') || values.get('ANON_KEY');
const secret = values.get('SECRET_KEY') || values.get('SERVICE_ROLE_KEY');
if (!apiUrl || !publishable || !secret) throw new Error('Supabase CLI did not return its local API URL and disposable keys.');
const parsed = new URL(apiUrl);
if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  throw new Error('Refusing to export a non-loopback Supabase URL into acceptance tests.');
}
if (process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_DB_PASSWORD) {
  throw new Error('Remote Supabase credentials/refs must not be present in the local acceptance job.');
}
// Runner step summaries can display exported environment values. Register the
// disposable local keys and connection string with the Actions masker first.
for (const value of [publishable, secret, values.get('DB_URL')].filter(Boolean)) {
  console.log(`::add-mask::${value}`);
}
const lines = [
  `LOCAL_SUPABASE_URL=${apiUrl}`,
  `LOCAL_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
  `LOCAL_SUPABASE_SECRET_KEY=${secret}`,
  `LOCAL_SUPABASE_DB_URL=${values.get('DB_URL') || ''}`,
  `LOCAL_SUPABASE_PROJECT_DIR=${path.resolve(project)}`,
];
for (const line of lines) if (line.endsWith('=')) throw new Error('A local Supabase endpoint is missing.');
await appendFile(githubEnv, `${lines.join('\n')}\n`);
const manifest = JSON.parse(await readFile(path.join(project, 'reviewed-migration-replay.json'), 'utf8'));
console.log(`Exported loopback-only endpoints for ${manifest.length} reviewed migrations; generated keys were not printed.`);
