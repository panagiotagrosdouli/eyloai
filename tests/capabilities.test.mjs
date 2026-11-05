import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from '../api/capabilities.js';

const keys = [
  'OPENAI_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
  'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'EYRA_EARLY_ACCESS_MONTHLY_LIMIT',
];
const snapshot = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});
function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}
function clearKeys() {
  for (const key of keys) delete process.env[key];
}

test('capability flags fail closed when optional services are absent', () => {
  clearKeys();
  const res = response();
  handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.ai, false);
  assert.equal(res.body.billing, false);
  assert.equal(res.body.scheduled_monitoring, false);
  assert.deepEqual(Object.keys(res.body).sort(), [
    'ai', 'billing', 'institution_analytics', 'scheduled_monitoring',
  ]);
});

test('billing requires every secret, price and server-side Supabase credential', () => {
  clearKeys();
  for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID']) process.env[key] = 'test-only';
  const absent = response();
  handler({ method: 'GET' }, absent);
  assert.equal(absent.body.billing, false);
  process.env.SUPABASE_SECRET_KEY = 'test-only';
  const enabled = response();
  handler({ method: 'GET' }, enabled);
  assert.equal(enabled.body.billing, true);
  process.env.STRIPE_WEBHOOK_SECRET = '';
  const broken = response();
  handler({ method: 'GET' }, broken);
  assert.equal(broken.body.billing, false);
});

test('AI availability depends on the server key, not browser flags', () => {
  clearKeys();
  process.env.OPENAI_API_KEY = 'test-only';
  const res = response();
  handler({ method: 'GET' }, res);
  assert.equal(res.body.ai, true);
  assert.equal(res.body.billing, false);
  assert.equal(JSON.stringify(res.body).includes('test-only'), false);
});

test('non-GET requests reject without being cached', () => {
  clearKeys();
  const res = response();
  handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});


test('early-access cap is public but does not expose credentials', () => {
  clearKeys();
  process.env.OPENAI_API_KEY = 'test-only';
  process.env.EYRA_EARLY_ACCESS_MONTHLY_LIMIT = '12';
  const missing = response();
  handler({ method: 'GET' }, missing);
  assert.equal(missing.body.ai, false, 'do not advertise available AI when quota cannot be enforced');
  assert.equal(missing.body.early_access_monthly_ai_actions, 12);
  process.env.SUPABASE_SECRET_KEY = 'test-only';
  const ready = response();
  handler({ method: 'GET' }, ready);
  assert.equal(ready.body.ai, true);
  assert.equal(JSON.stringify(ready.body).includes('test-only'), false);
});

test('invalid early-access cap fails closed', () => {
  clearKeys();
  process.env.EYRA_EARLY_ACCESS_MONTHLY_LIMIT = '-2';
  const res = response();
  handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.early_access_monthly_ai_actions, undefined);
});
