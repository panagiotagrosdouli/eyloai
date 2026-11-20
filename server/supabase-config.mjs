/**
 * Read only an explicitly configured Supabase project for serverless handlers.
 * Requiring the official HTTPS host suffix prevents bearer tokens and service
 * credentials from being sent to an arbitrary host by a mistyped env value.
 */
export function readSupabaseApiConfig(env = process.env) {
  const normalizeUrl = value => String(value || '').trim().replace(/\/$/, '');
  const serverUrl = normalizeUrl(env.SUPABASE_URL);
  const browserUrl = normalizeUrl(env.VITE_SUPABASE_URL);
  // Runtime configuration need not duplicate Vite's build-time variable.
  // A disagreement is unsafe: never silently select a different tenant.
  const urlConflict = Boolean(serverUrl && browserUrl && serverUrl !== browserUrl);
  const url = serverUrl || browserUrl;
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
    url: validUrl && !urlConflict ? url : '',
    urlConflict,
    publicKey,
    serverKey,
    hasPublicConfig: validUrl && !urlConflict && Boolean(publicKey),
    hasServerConfig: validUrl && !urlConflict && Boolean(serverKey),
  };
}
