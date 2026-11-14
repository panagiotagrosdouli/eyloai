import { readSupabaseApiConfig } from './supabase-config.mjs';

// Operator-side only. Report variable names, never their values or provider errors.
export function diagnoseConfiguration(env = process.env) {
  const present = key => Boolean(String(env[key] || '').trim());
  const config = readSupabaseApiConfig(env);
  const database = [];
  if (!present('VITE_SUPABASE_URL')) database.push('VITE_SUPABASE_URL');
  else if (!config.url) database.push('VITE_SUPABASE_URL (invalid official HTTPS project URL)');
  if (!config.publicKey) database.push('SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  if (!config.serverKey) database.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');

  const groups = {
    ai: [...database, ...(!present('OPENAI_API_KEY') ? ['OPENAI_API_KEY'] : [])],
    discovery: database.filter(item => !item.startsWith('SUPABASE_PUBLISHABLE_KEY')),
    contact: ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'RESEND_FROM_EMAIL'].filter(key => !present(key)),
    billing: [...database, ...['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID'].filter(key => !present(key))],
  };
  const unsafe = Object.keys(env).filter(key => key.startsWith('VITE_') && present(key) &&
    (/SECRET|SERVICE_ROLE|OPENAI_API_KEY|RESEND_API_KEY|LIVEKIT_API_KEY|CRON_SECRET/i.test(key) || String(env[key]).trim().startsWith('sb_secret_')));
  if (String(env.VITE_SUPABASE_ANON_KEY || '').trim().split('.').length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(env.VITE_SUPABASE_ANON_KEY.trim().split('.')[1], 'base64url').toString());
      if (claims.role === 'service_role' && !unsafe.includes('VITE_SUPABASE_ANON_KEY')) unsafe.push('VITE_SUPABASE_ANON_KEY');
    } catch { /* No credential contents belong in diagnostics. */ }
  }
  return {
    decision: unsafe.length ? 'UNSAFE_PUBLIC_CONFIGURATION' : Object.values(groups).some(missing => missing.length) ? 'CONFIGURATION_INCOMPLETE' : 'CONFIGURATION_PRESENT',
    services: Object.fromEntries(Object.entries(groups).map(([name, missing]) => [name, { configured: missing.length === 0, missing }])),
    unsafe_public_variables: unsafe,
    required_verification: {
      discovery: 'Verify the reviewed consume_discovery_rate_limit migration and service-role RPC access in the intended database. Configuration presence alone cannot verify the quota service.',
      ai: 'Verify authenticated EYRA requests, usage controls and provider access on isolated staging.',
      billing: 'Verify Stripe test-mode checkout, signed webhooks and entitlement lifecycle before enabling paid access.',
      contact: 'Verify the sending domain and actual message delivery.',
      privacy_and_operations: 'Verify two-account isolation, Storage access, deletion and backup restore on isolated staging.',
    },
    note: 'Local configuration presence only; no network requests, secret values, migrations or production authorization.',
  };
}
