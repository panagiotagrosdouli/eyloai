import { readFile } from 'node:fs/promises';

const ALLOWED_CLASSES = new Set([
  'Public client configuration',
  'Server-only secret',
  'Server-only configuration',
  'Production-only configuration',
  'Staging-only configuration',
]);
const ALLOWED_KINDS = new Set([
  'required dependency',
  'optional integration',
  'production-only configuration',
]);
const SECRET_NAME = /(?:SECRET|SERVICE_ROLE|OPENAI_API_KEY|RESEND_API_KEY|LIVEKIT_API_KEY|PRIVATE_KEY)/i;

export function validateEnvironmentManifest(manifest, env = {}) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.variables) || !Array.isArray(manifest.profiles)) {
    return ['Manifest must use schemaVersion 1 and define profiles and variables arrays.'];
  }

  const names = new Set();
  for (const variable of manifest.variables) {
    if (!variable || typeof variable.name !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(variable.name)) {
      errors.push('Every environment variable requires a valid uppercase name.');
      continue;
    }
    if (names.has(variable.name)) errors.push(`Duplicate manifest variable: ${variable.name}.`);
    names.add(variable.name);
    if (!ALLOWED_CLASSES.has(variable.class)) errors.push(`Invalid classification for ${variable.name}.`);
    if (!ALLOWED_KINDS.has(variable.kind)) errors.push(`Invalid dependency kind for ${variable.name}.`);
    if (!Array.isArray(variable.environments) || variable.environments.some(item => !manifest.profiles.includes(item))) {
      errors.push(`Invalid environment scope for ${variable.name}.`);
    }
    if (typeof variable.required !== 'boolean') errors.push(`Required flag missing for ${variable.name}.`);
    if (typeof variable.description !== 'string' || !variable.description.trim()) errors.push(`Description missing for ${variable.name}.`);
    if (variable.class === 'Server-only secret' && variable.name.startsWith('VITE_')) {
      errors.push(`Server-only secret ${variable.name} cannot be exposed through the Vite client prefix.`);
    }
    if (variable.class === 'Public client configuration' && SECRET_NAME.test(variable.name) &&
        !['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'].includes(variable.name)) {
      errors.push(`Secret-like variable ${variable.name} cannot be classified as public.`);
    }
  }

  const publicSecrets = Object.keys(env).filter(name => name.startsWith('VITE_') && SECRET_NAME.test(name) && String(env[name] || '').trim());
  for (const name of publicSecrets) errors.push(`Secret-like runtime variable ${name} is set with the public Vite prefix.`);
  return errors;
}

export async function loadEnvironmentManifest(url = new URL('../config/environment-manifest.json', import.meta.url)) {
  return JSON.parse(await readFile(url, 'utf8'));
}
