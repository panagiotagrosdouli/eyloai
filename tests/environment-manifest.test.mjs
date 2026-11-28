import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadEnvironmentManifest, validateEnvironmentManifest } from '../server/environment-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:[cm]?js|jsx|ts)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

test('environment manifest has a unique, complete classification for each configured application variable', async () => {
  const manifest = await loadEnvironmentManifest();
  assert.deepEqual(validateEnvironmentManifest(manifest), []);
  const names = new Set(manifest.variables.map(item => item.name));
  const example = await readFile(resolve(root, '.env.example'), 'utf8');
  const exampleNames = example.split(/\r?\n/).map(line => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean);
  assert.deepEqual(exampleNames.filter(name => !names.has(name)), [], '.env.example must not contain unclassified app variables');
  const codeFiles = (await Promise.all(['api', 'server', 'src', 'scripts', 'supabase/functions']
    .map(folder => sourceFiles(resolve(root, folder))))).flat();
  const referenced = new Set();
  for (const file of codeFiles) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)/g)) referenced.add(match[1]);
    for (const match of source.matchAll(/Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g)) referenced.add(match[1]);
  }
  assert.deepEqual([...referenced].filter(name => !names.has(name)).sort(), [], 'all application source environment references must be classified');
  for (const name of [
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENALEX_API_KEY', 'SEMANTIC_SCHOLAR_API_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'CRON_SECRET',
    'LIVEKIT_API_SECRET', 'EYLO_STAGING_SUPABASE_REF', 'EYLO_PRIVACY_WORKER_SECRET',
  ]) assert.ok(names.has(name), `missing ${name}`);
});

test('environment manifest rejects a secret assigned to the public Vite namespace without echoing values', async () => {
  const manifest = await loadEnvironmentManifest();
  const errors = validateEnvironmentManifest(manifest, { VITE_OPENAI_API_KEY: 'private-marker' });
  assert.match(errors.join('\n'), /VITE_OPENAI_API_KEY/);
  assert.doesNotMatch(errors.join('\n'), /private-marker/);
});

test('environment manifest rejects invalid scopes, duplicate names, and public secret classifications', async () => {
  const manifest = await loadEnvironmentManifest();
  const broken = structuredClone(manifest);
  broken.variables.push({
    ...broken.variables.find(item => item.name === 'VITE_SUPABASE_URL'),
    name: 'VITE_OPENAI_API_KEY',
    class: 'Public client configuration',
    environments: ['unknown'],
  });
  const errors = validateEnvironmentManifest(broken);
  assert.ok(errors.some(error => /Invalid environment scope/.test(error)));
  assert.ok(errors.some(error => /cannot be classified as public/.test(error)));
  broken.variables.push({ ...broken.variables[0] });
  assert.ok(validateEnvironmentManifest(broken).some(error => /Duplicate manifest variable/.test(error)));
});
