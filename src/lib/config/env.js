const REQUIRED_ENVIRONMENT_VARIABLES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

// These are browser-safe Supabase identifiers. They are intentionally public
// and remain protected by Supabase Auth plus Row Level Security.
const PUBLIC_SUPABASE_FALLBACK = {
  VITE_SUPABASE_URL: 'https://kbzjngpzxpniaumlupaa.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_QOF_tW8ve4IFUsflluOhww_aRubMF0V',
};

function readEnvironment() {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL?.trim() || PUBLIC_SUPABASE_FALLBACK.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || PUBLIC_SUPABASE_FALLBACK.VITE_SUPABASE_ANON_KEY,
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
