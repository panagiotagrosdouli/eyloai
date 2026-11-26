import { verifyStagingConfig } from './verify-staging-config.mjs';

export function validateEyloStorageStagingConfig(env) {
  const url = String(env.EYLO_STORAGE_SUPABASE_URL || '').trim();
  const key = String(env.EYLO_STORAGE_PUBLISHABLE_KEY || '').trim();
  const a = { email: String(env.EYLO_STORAGE_TEST_A_EMAIL || '').trim(), password: String(env.EYLO_STORAGE_TEST_A_PASSWORD || '') };
  const b = { email: String(env.EYLO_STORAGE_TEST_B_EMAIL || '').trim(), password: String(env.EYLO_STORAGE_TEST_B_PASSWORD || '') };
  const staging = verifyStagingConfig({
    ...env,
    EYLO_ENVIRONMENT: env.EYLO_ENVIRONMENT,
    EYLO_STAGING_SUPABASE_REF: env.EYLO_STAGING_SUPABASE_REF,
    EYLO_STAGING_CONFIRMED_REF: env.EYLO_STAGING_CONFIRMED_REF,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: key,
    VITE_SUPABASE_USE_PROXY: env.VITE_SUPABASE_USE_PROXY,
  });
  const errors = [...staging.errors];
  if (!key || key !== env.VITE_SUPABASE_ANON_KEY) errors.push('The Storage publishable key must exactly match the configured public staging key.');
  if (env.EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES !== 'YES') errors.push('Explicit authorization for disposable staging file writes is required.');
  if (!a.email || !a.password || !b.email || !b.password) errors.push('Two disposable staging account credentials are required.');
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) errors.push('Storage isolation requires two distinct staging accounts.');
  return { ok: errors.length === 0, errors, url: errors.length === 0 ? url : null, projectRef: errors.length === 0 ? staging.projectRef : null };
}
