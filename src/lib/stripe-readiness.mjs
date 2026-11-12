export function stripeTestModeEnabled(env = process.env) {
  const key = String(env.STRIPE_SECRET_KEY || '').trim();
  const explicitTestMode = env.EYLO_STRIPE_TEST_MODE === '1';
  const testSecret = key.startsWith('sk_test_') || key.startsWith('rk_test_');
  return explicitTestMode && testSecret;
}
