import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from '../api/capabilities.js';

const keys = [
  'OPENAI_API_KEY', 'RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'RESEND_FROM_EMAIL',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
  'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY',
  'EYLO_ANALYTICS_ENABLED',
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
  assert.equal(res.body.contact, false);
  assert.equal(res.body.scheduled_monitoring, false);
  assert.equal(res.body.institution_analytics, false);
  assert.deepEqual(Object.keys(res.body).sort(), [
    'ai', 'billing', 'contact', 'institution_analytics', 'scheduled_monitoring',
  ]);
});

test('contact is available only when all email delivery settings are present', () => {
  clearKeys();
  process.env.RESEND_API_KEY = 'test-only';
  process.env.CONTACT_TO_EMAIL = 'team@example.test';
  const missingSender = response();
  handler({ method: 'GET' }, missingSender);
  assert.equal(missingSender.body.contact, false);
  process.env.RESEND_FROM_EMAIL = 'EYLO <hello@example.test>';
  const configured = response();
  handler({ method: 'GET' }, configured);
  assert.equal(configured.body.contact, true);
  assert.equal(JSON.stringify(configured.body).includes('example.test'), false);
});

test('billing requires every secret, price and server-side Supabase credential', () => {
  clearKeys();
  for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID']) process.env[key] = 'test-only';
  const absent = response();
  handler({ method: 'GET' }, absent);
  assert.equal(absent.body.billing, false);
  process.env.SUPABASE_SECRET_KEY = 'test-only';
  const missingProject = response();
  handler({ method: 'GET' }, missingProject);
  assert.equal(missingProject.body.billing, false);

  process.env.VITE_SUPABASE_URL = 'https://eylo-capability-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-only';
  const enabled = response();
  handler({ method: 'GET' }, enabled);
  assert.equal(enabled.body.billing, true);
  process.env.STRIPE_WEBHOOK_SECRET = '';
  const broken = response();
  handler({ method: 'GET' }, broken);
  assert.equal(broken.body.billing, false);
});

test('AI availability requires both the model key and server-side quota controls', () => {
  clearKeys();
  process.env.OPENAI_API_KEY = 'test-only';
  const unmetered = response();
  handler({ method: 'GET' }, unmetered);
  assert.equal(unmetered.body.ai, false);

  process.env.SUPABASE_SECRET_KEY = 'server-test-only';
  const incomplete = response();
  handler({ method: 'GET' }, incomplete);
  assert.equal(incomplete.body.ai, false);

  process.env.VITE_SUPABASE_URL = 'https://eylo-capability-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-only';
  const ready = response();
  handler({ method: 'GET' }, ready);
  assert.equal(ready.body.ai, true);

  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  const invalidOrigin = response();
  handler({ method: 'GET' }, invalidOrigin);
  assert.equal(invalidOrigin.body.ai, false, 'untrusted Supabase origins must not enable AI');
  assert.equal(ready.body.billing, false);
  assert.equal(JSON.stringify(ready.body).includes('test-only'), false);
});

test('non-GET requests reject without being cached', () => {
  clearKeys();
  const res = response();
  handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});


test('institution analytics stays disabled unless explicitly enabled after verification', () => {
  clearKeys();
  for (const setting of ['', 'true', 'yes', '0', '2']) {
    process.env.EYLO_ANALYTICS_ENABLED = setting;
    const res = response();
    handler({ method: 'GET' }, res);
    assert.equal(res.body.institution_analytics, false);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
  process.env.EYLO_ANALYTICS_ENABLED = '1';
  const enabled = response();
  handler({ method: 'GET' }, enabled);
  assert.equal(enabled.body.institution_analytics, true);
});
