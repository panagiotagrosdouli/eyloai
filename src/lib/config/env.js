const REQUIRED_ENVIRONMENT_VARIABLES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

function readEnvironment() {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL?.trim() || '',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '',
  };
}

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export function validateEnvironment() {
  const values = readEnvironment();
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !values[name]);
  const invalid = [];

  if (values.VITE_SUPABASE_URL && !isValidSupabaseUrl(values.VITE_SUPABASE_URL)) {
    invalid.push('VITE_SUPABASE_URL');
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    values,
  };
}

export const environment = validateEnvironment();
export { REQUIRED_ENVIRONMENT_VARIABLES };
