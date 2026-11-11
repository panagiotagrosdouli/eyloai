// EYLO production must never silently authenticate against another tenant.
const EYLO_PRODUCTION_SUPABASE_URL = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const EYLO_PRODUCTION_HOSTS = new Set(['eyloai.vercel.app', 'panagiotagrosdouli.github.io']);

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

/**
 * @typedef {Object} SupabaseEnvironmentSource
 * @property {string} [VITE_SUPABASE_URL]
 * @property {string} [VITE_SUPABASE_ANON_KEY]
 * @property {boolean} [PROD]
 */

/** @param {SupabaseEnvironmentSource} [source] */
function readEnvironment(source = /** @type {SupabaseEnvironmentSource} */ (import.meta.env ?? {})) {
  return {
    VITE_SUPABASE_URL: source.VITE_SUPABASE_URL?.trim() || '',
    VITE_SUPABASE_ANON_KEY: source.VITE_SUPABASE_ANON_KEY?.trim() || '',
  };
}

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)
      && !url.username && !url.password && !url.port
      && (url.pathname === '/' || url.pathname === '')
      && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/**
 * @param {SupabaseEnvironmentSource} [source]
 * @param {string} [hostname] Current deployment hostname. Injected for tests only.
 */
export function validateEnvironment(
  source = /** @type {SupabaseEnvironmentSource} */ (import.meta.env ?? {}),
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
) {
  const values = readEnvironment(source);
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !values[name]);
  const invalid = [];

  if (values.VITE_SUPABASE_URL && !isValidSupabaseUrl(values.VITE_SUPABASE_URL)) {
    invalid.push('VITE_SUPABASE_URL');
  }

  // Vite PROD is also true for preview builds. Pin only the actual EYLO
  // production origins; allow isolated preview test tenants without leaking
  // their credentials to the canonical deployment.
  if (source.PROD === true && EYLO_PRODUCTION_HOSTS.has(hostname.toLowerCase())
    && values.VITE_SUPABASE_URL.replace(/\/$/, '') !== EYLO_PRODUCTION_SUPABASE_URL) {
    if (!invalid.includes('VITE_SUPABASE_URL')) invalid.push('VITE_SUPABASE_URL');
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    values,
  };
}

export const environment = validateEnvironment();
export { REQUIRED_ENVIRONMENT_VARIABLES, EYLO_PRODUCTION_SUPABASE_URL };
