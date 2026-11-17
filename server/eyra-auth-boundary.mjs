import { readSupabaseApiConfig } from './supabase-config.mjs';

/** Owner identity and private entitlement lookup. Never trust browser-supplied user IDs. */
export function supabaseServerKey() {
  return process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function serverHeaders(key) {
  const headers = {
    apikey: key,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  return headers;
}

export function billingActive() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_WEBHOOK_SECRET
    && process.env.STRIPE_PRO_PRICE_ID
    && process.env.STRIPE_FOUNDER_PRICE_ID
    && supabaseServerKey()
  );
}

export async function authenticate(authorization) {
  const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!bearer?.startsWith('Bearer ') || !bearer.slice(7).trim()) {
    console.warn('EYRA auth rejected', { reason: 'missing_bearer' });
    return null;
  }

  const config = readSupabaseApiConfig();
  if (!config.hasPublicConfig) {
    console.error('EYRA auth rejected', { reason: 'missing_supabase_public_key' });
    return null;
  }
  const { publicKey, url: supabaseUrl } = config;

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization: bearer, apikey: publicKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!authResponse.ok) {
    console.warn('EYRA auth rejected', { reason: 'supabase_user_rejected', status: authResponse.status });
    return null;
  }
  const user = await authResponse.json();

  let entitlement = {};
  const serverKey = supabaseServerKey();
  if (billingActive()) {
    const entitlementResponse = await fetch(
      `${supabaseUrl}/rest/v1/billing_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`,
      { headers: serverHeaders(serverKey) },
    );
    if (!entitlementResponse.ok) {
      throw new Error('Could not load EYRA billing entitlement.');
    }
    const rows = await entitlementResponse.json();
    entitlement = rows?.[0] || {};
  }

  return { user, entitlement, serverKey, supabaseUrl, bearer, publicKey };
}

