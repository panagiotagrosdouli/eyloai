/**
 * Read only an explicitly configured Supabase project for serverless handlers.
 * Requiring the official HTTPS host suffix prevents bearer tokens and service
 * credentials from being sent to an arbitrary host by a mistyped env value.
 */
export function readSupabaseApiConfig(env = process.env) {
  const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publicKey = String(
    env.SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.VITE_SUPABASE_ANON_KEY
    || '',
  ).trim();
  const serverKey = String(
    env.SUPABASE_SECRET_KEY
    || env.SUPABASE_SERVICE_ROLE_KEY
    || '',
  ).trim();

  let validUrl = false;
  try {
    const parsed = new URL(url);
    validUrl = parsed.protocol === 'https:'
      && parsed.hostname.endsWith('.supabase.co')
      && !parsed.username
      && !parsed.password
      && !parsed.port
      && parsed.pathname === '/'
      && !parsed.search
      && !parsed.hash;
  } catch {
    // Missing and invalid configuration both fail closed.
  }

  return {
    url: validUrl ? url : '',
    publicKey,
    serverKey,
    hasPublicConfig: validUrl && Boolean(publicKey),
    hasServerConfig: validUrl && Boolean(serverKey),
  };
}
