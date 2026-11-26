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
  if (env.VITE_SUPABASE_URL !== url) errors.push('VITE_SUPABASE_URL must exactly match the authorized Storage staging URL.');
  if (!key || key !== env.VITE_SUPABASE_ANON_KEY) errors.push('The Storage publishable key must exactly match the configured public staging key.');
  if (env.EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES !== 'YES') errors.push('Explicit authorization for disposable staging file writes is required.');

  // Configuration only: the operator must independently inspect the live
  // Vercel Preview before granting any write authorization.
  const approvedSha = String(env.EYLO_STORAGE_APPROVED_PREVIEW_SHA || '').trim().toLowerCase();
  const observedSha = String(env.VERCEL_GIT_COMMIT_SHA || '').trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(approvedSha) || approvedSha !== observedSha) {
    errors.push('Approved Preview SHA must match the Vercel-declared commit SHA.');
  }
  const approvedUrl = String(env.EYLO_STORAGE_APPROVED_PREVIEW_URL || '').trim();
  const observedHost = String(env.VERCEL_URL || '').trim().toLowerCase();
  let approvedHost = '';
  try {
    const parsed = new URL(approvedUrl);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname === '/') approvedHost = parsed.hostname.toLowerCase();
  } catch { /* Invalid approved preview URL is rejected below. */ }
  if (!approvedHost || !observedHost || approvedHost !== observedHost || approvedHost === 'eyloai.vercel.app' || approvedHost === 'panagiotagrosdouli.github.io') {
    errors.push('Approved exact Preview URL must match VERCEL_URL and not be a production alias.');
  }
  if (env.EYLO_STORAGE_APPROVED_CLEANUP_SCOPE !== 'generated-fixtures-only') {
    errors.push('Owner-approved cleanup scope must be restricted to generated fixture paths.');
  }
  if (env.EYLO_STORAGE_TEST_A_INBOX_AUTHORIZED !== 'YES' || env.EYLO_STORAGE_TEST_B_INBOX_AUTHORIZED !== 'YES') {
    errors.push('Both disposable test inboxes must be explicitly authorized.');
  }
  if (env.VITE_SUPABASE_USE_PROXY !== 'false') errors.push('VITE_SUPABASE_USE_PROXY must explicitly be false for direct staging isolation checks.');
  if (env.VERCEL_ENV !== 'preview') errors.push('Storage hosted acceptance requires an explicitly identified Vercel Preview environment.');
  if (!a.email || !a.password || !b.email || !b.password) errors.push('Two disposable staging account credentials are required.');
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) errors.push('Storage isolation requires two distinct staging accounts.');
  return { ok: errors.length === 0, errors, url: errors.length === 0 ? url : null, projectRef: errors.length === 0 ? staging.projectRef : null };
}
