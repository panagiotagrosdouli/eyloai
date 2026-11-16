import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBillingTestEnabled } from '../server/billing-activation.mjs';
import billingHandler from '../api/billing.js';

const STAGING_REF = 'abcdefghijklmnopqrst';
const enabledSettings = Object.freeze({
  VITE_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: 'test-public',
  SUPABASE_SECRET_KEY: 'test-server',
  EYLO_ENVIRONMENT: 'staging',
  EYLO_BILLING_TEST_ENABLED: '1',
  EYLO_STAGING_SUPABASE_REF: STAGING_REF,
  EYLO_STAGING_CONFIRMED_REF: STAGING_REF,
  STRIPE_SECRET_KEY: 'sk_test_fixture',
  STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  STRIPE_PRO_PRICE_ID: 'price_fixturepro',
  STRIPE_FOUNDER_PRICE_ID: 'price_fixturefounder',
});

test('billing test-mode activation requires every explicit staging identity and secret', () => {
  assert.equal(isBillingTestEnabled(enabledSettings), true);
  for (const key of Object.keys(enabledSettings)) {
    const missing = { ...enabledSettings };
    delete missing[key];
    assert.equal(isBillingTestEnabled(missing), false, `missing ${key} must fail closed`);
  }
});

test('checkout is never activated on live EYLO, unrelated tenant or with live Stripe keys', () => {
  const productionRef = 'kbzjngpzxpniaumlupaa';
  const unrelatedRef = 'umzrggayitzfgrrofjnw';
  for (const ref of [productionRef, unrelatedRef]) {
    assert.equal(isBillingTestEnabled({
      ...enabledSettings,
      VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
      EYLO_STAGING_SUPABASE_REF: ref,
      EYLO_STAGING_CONFIRMED_REF: ref,
    }), false);
  }
  assert.equal(isBillingTestEnabled({ ...enabledSettings, EYLO_ENVIRONMENT: 'production' }), false);
  assert.equal(isBillingTestEnabled({ ...enabledSettings, STRIPE_SECRET_KEY: 'sk_live_forbidden' }), false);
  assert.equal(isBillingTestEnabled({ ...enabledSettings, EYLO_STAGING_CONFIRMED_REF: 'differentprojectrefx' }), false);
  assert.equal(isBillingTestEnabled({ ...enabledSettings, VITE_SUPABASE_URL: 'https://example.invalid' }), false);
});

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('disabled billing POST is blocked before user or Stripe network requests', async () => {
  const originalFetch = globalThis.fetch;
  const environmentKeys = Object.keys(enabledSettings);
  const previous = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
  try {
    for (const key of environmentKeys) process.env[key] = enabledSettings[key];
    process.env.EYLO_BILLING_TEST_ENABLED = '0';
    globalThis.fetch = () => { throw new Error('No upstream request is allowed while disabled.'); };
    const response = fakeResponse();
    await billingHandler({ method: 'POST', headers: {}, body: { action: 'checkout', plan: 'pro' } }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, 'BILLING_TEST_DISABLED');
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
