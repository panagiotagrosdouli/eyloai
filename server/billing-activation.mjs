import { readSupabaseApiConfig } from './supabase-config.mjs';

// Activation is deliberately narrower than "credentials are present":
// only an independently provisioned, explicitly identified staging project
// may create Stripe TEST-mode checkout sessions. This does not attest that
// Stripe, database migrations or end-to-end billing were tested.
const REF_FROM_URL = /^https:\/\/([a-z]{20})\.supabase\.co$/;
const EXCLUDED_REFS = new Set([
  'kbzjngpzxpniaumlupaa', // EYLO production
  'umzrggayitzfgrrofjnw', // unrelated historical workspace
]);

export function isBillingTestEnabled(env = process.env) {
  const config = readSupabaseApiConfig(env);
  const projectRef = REF_FROM_URL.exec(config.url)?.[1];
  return Boolean(
    projectRef
    && !EXCLUDED_REFS.has(projectRef)
    && env.EYLO_ENVIRONMENT === 'staging'
    && env.EYLO_BILLING_TEST_ENABLED === '1'
    && env.EYLO_STAGING_SUPABASE_REF === projectRef
    && env.EYLO_STAGING_CONFIRMED_REF === projectRef
    && config.hasPublicConfig
    && config.hasServerConfig
    && /^sk_test_[A-Za-z0-9_-]+$/.test(env.STRIPE_SECRET_KEY || '')
    && /^whsec_[A-Za-z0-9_-]+$/.test(env.STRIPE_WEBHOOK_SECRET || '')
    && /^price_[A-Za-z0-9_-]+$/.test(env.STRIPE_PRO_PRICE_ID || '')
    && /^price_[A-Za-z0-9_-]+$/.test(env.STRIPE_FOUNDER_PRICE_ID || '')
  );
}
