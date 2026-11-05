/**
 * Guards for a direct PostgREST two-account RLS acceptance probe.
 * Never accept arbitrary URLs or privileged API keys from CLI flags.
 */
export const USER_OWNED_TABLES = Object.freeze([
  'projects', 'ideas', 'meetings', 'saved_papers', 'saved_researchers',
  'saved_opportunities', 'search_history', 'watchlists',
  'monitoring_discoveries', 'notifications',
]);

export function verifiedSupabaseOrigin(url, expectedRef) {
  if (!/^[a-z0-9]{12,32}$/.test(String(expectedRef || ''))) {
    throw new Error('A valid, manually confirmed production Supabase project ref is required.');
  }
  let parsed;
  try { parsed = new URL(String(url || '')); } catch {
    throw new Error('A valid Supabase project URL is required.');
  }
  if (parsed.protocol !== 'https:' ||
      parsed.hostname !== `${expectedRef}.supabase.co` ||
      parsed.port || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Audit target must be the exact HTTPS origin of the expected Supabase project.');
  }
  return parsed.origin;
}

export function auditPlan(env, args = []) {
  const wantsLive = args.includes('--live');
  const wantsWrites = args.includes('--write-test-fixtures');
  if (args.some(arg => !['--live', '--write-test-fixtures'].includes(arg))) {
    throw new Error('Unknown audit argument.');
  }
  if (wantsWrites && !wantsLive) throw new Error('Fixture writes require --live.');
  if (!wantsLive) return { mode: 'preflight', writes: false, tables: USER_OWNED_TABLES };

  if (env.EYLO_RLS_LIVE !== '1') throw new Error('Live checks require EYLO_RLS_LIVE=1.');
  const expectedRef = env.EYLO_RLS_EXPECTED_PROJECT_REF;
  const origin = verifiedSupabaseOrigin(env.EYLO_RLS_SUPABASE_URL, expectedRef);
  if (!env.EYLO_RLS_CONFIRMED_PRODUCTION_URL ||
      verifiedSupabaseOrigin(env.EYLO_RLS_CONFIRMED_PRODUCTION_URL, expectedRef) !== origin) {
    throw new Error('Confirm the production project URL separately before live checks.');
  }
  const publicKey = String(env.EYLO_RLS_PUBLIC_KEY || '').trim();
  const legacyJwtSegments = publicKey.split('.');
  let privilegedOrMalformedLegacyKey = false;
  if (legacyJwtSegments.length === 3) {
    try {
      const payload = JSON.parse(atob(legacyJwtSegments[1].replace(/-/g, '+').replace(/_/g, '/')));
      privilegedOrMalformedLegacyKey = payload.role !== 'anon';
    } catch {
      privilegedOrMalformedLegacyKey = true;
    }
  }
  if (!publicKey || publicKey.startsWith('sb_secret_') ||
      publicKey.startsWith('sb_service_') || privilegedOrMalformedLegacyKey) {
    throw new Error('A public Supabase publishable/anon key is required; never use a server secret.');
  }
  for (const key of ['EYLO_RLS_TOKEN_A', 'EYLO_RLS_TOKEN_B']) {
    if (!env[key] || !String(env[key]).trim()) {
      throw new Error('Two disposable-account access tokens must be configured privately.');
    }
  }
  if (env.EYLO_RLS_TOKEN_A === env.EYLO_RLS_TOKEN_B) {
    throw new Error('Account A and B tokens must be different.');
  }
  if (wantsWrites && env.EYLO_RLS_TEST_WRITES !== 'DISPOSABLE_ACCOUNTS_ONLY') {
    throw new Error('Fixture writes require EYLO_RLS_TEST_WRITES=DISPOSABLE_ACCOUNTS_ONLY.');
  }
  const tableInput = env.EYLO_RLS_TABLES || 'projects,saved_papers';
  const tables = [...new Set(String(tableInput).split(',').map(t => t.trim()))];
  if (!tables.length || tables.some(t => !USER_OWNED_TABLES.includes(t))) {
    throw new Error('Table selection contains unsupported or empty table names.');
  }
  return {
    mode: 'live', writes: wantsWrites, origin, tables,
    publicKey,
    tokenA: env.EYLO_RLS_TOKEN_A,
    tokenB: env.EYLO_RLS_TOKEN_B,
  };
}
