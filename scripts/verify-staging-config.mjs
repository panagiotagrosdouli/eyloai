import { pathToFileURL } from 'node:url';

const FORBIDDEN = new Set(['kbzjngpzxpniaumlupaa', 'umzrggayitzfgrrofjnw']);
export function verifyStagingConfig(env) {
  const ref = String(env.EYLO_STAGING_SUPABASE_REF || '').trim();
  const errors = [];
  if (!/^[a-z]{20}$/.test(ref) || FORBIDDEN.has(ref)) errors.push('Use a separate authorized staging Supabase ref, never live EYLO or the unrelated connected project.');
  if (env.EYLO_STAGING_CONFIRMED_REF !== ref) errors.push('Owner-confirmed staging ref must exactly match EYLO_STAGING_SUPABASE_REF.');
  if (env.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`) errors.push('VITE_SUPABASE_URL must exactly identify the confirmed staging project.');
  if (env.EYLO_ENVIRONMENT !== 'staging' || env.VERCEL_ENV === 'production') errors.push('This configuration is for staging/Preview only.');
  if (env.VITE_SUPABASE_USE_PROXY === 'true') errors.push('Staging must use its own Supabase URL directly. Disable the legacy production proxy.');
  const publicKey = String(env.VITE_SUPABASE_ANON_KEY || '');
  if (!publicKey || publicKey.startsWith('sb_secret_')) errors.push('A public staging Supabase key is required; never use a server key in VITE variables.');
  if (publicKey.split('.').length === 3) {
    try { if (JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role !== 'anon') errors.push('The legacy browser key must have the anon role.'); }
    catch { errors.push('The legacy public key is malformed.'); }
  }
  return { ok: errors.length === 0, errors, projectRef: ref };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verifyStagingConfig(process.env);
  if (!result.ok) { result.errors.forEach(error => console.error(error)); process.exitCode = 1; }
  else console.log(`Staging target preflight passed for ${result.projectRef}. This does not verify hosted access or authorize migrations.`);
}
