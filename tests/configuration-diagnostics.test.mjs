import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseConfiguration } from '../server/configuration-diagnostics.mjs';

const configured = {
  VITE_SUPABASE_URL: 'https://configuration-test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'fixture-public',
  SUPABASE_SECRET_KEY: 'fixture-server-private',
  OPENAI_API_KEY: 'fixture-openai-private',
  RESEND_API_KEY: 'fixture-email-private',
  CONTACT_TO_EMAIL: 'owner@example.test',
  RESEND_FROM_EMAIL: 'EYLO <hello@example.test>',
  STRIPE_SECRET_KEY: 'fixture-stripe-private',
  STRIPE_WEBHOOK_SECRET: 'fixture-webhook-private',
  STRIPE_PRO_PRICE_ID: 'fixture-price-pro',
  STRIPE_FOUNDER_PRICE_ID: 'fixture-price-founder',
};

test('explains missing server configuration even when an OpenAI key is present', () => {
  const result = diagnoseConfiguration({ OPENAI_API_KEY: configured.OPENAI_API_KEY });
  assert.equal(result.services.ai.configured, false);
  assert.ok(result.services.ai.missing.includes('SUPABASE_URL or VITE_SUPABASE_URL'));
  assert.ok(result.services.ai.missing.some(name => name.includes('SUPABASE_SECRET_KEY')));
  assert.ok(!result.services.ai.missing.includes('OPENAI_API_KEY'));
  assert.equal(result.decision, 'CONFIGURATION_INCOMPLETE');
});

test('configuration presence does not claim provider, migration or production acceptance', () => {
  const result = diagnoseConfiguration(configured);
  assert.equal(result.decision, 'CONFIGURATION_PRESENT');
  assert.ok(Object.values(result.services).every(service => service.configured));
  assert.match(result.required_verification.discovery, /consume_discovery_rate_limit/);
  for (const value of Object.values(configured)) assert.ok(!JSON.stringify(result).includes(value));
});

test('discovery needs a valid project and server key, independently of the public Auth key', () => {
  const result = diagnoseConfiguration({ VITE_SUPABASE_URL: configured.VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'fixture-legacy' });
  assert.equal(result.services.discovery.configured, true);
  assert.equal(result.services.ai.configured, false);
  assert.equal(diagnoseConfiguration({ ...configured, VITE_SUPABASE_URL: 'https://other.example' }).services.discovery.configured, false);
});

test('rejects whitespace credentials and reports browser-exposed secrets without values', () => {
  const result = diagnoseConfiguration({ ...configured, OPENAI_API_KEY: '  ', VITE_OPENAI_API_KEY: 'must-not-print', VITE_SUPABASE_ANON_KEY: 'sb_secret_must-not-print' });
  assert.equal(result.decision, 'UNSAFE_PUBLIC_CONFIGURATION');
  assert.ok(result.services.ai.missing.includes('OPENAI_API_KEY'));
  assert.deepEqual(result.unsafe_public_variables.sort(), ['VITE_OPENAI_API_KEY', 'VITE_SUPABASE_ANON_KEY']);
  assert.ok(!JSON.stringify(result).includes('must-not-print'));
});

test('detects a legacy service-role JWT in public configuration without disclosing claims', () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role', private: 'never-disclose' })).toString('base64url')}.signature`;
  const result = diagnoseConfiguration({ ...configured, VITE_SUPABASE_ANON_KEY: jwt });
  assert.equal(result.decision, 'UNSAFE_PUBLIC_CONFIGURATION');
  assert.ok(result.unsafe_public_variables.includes('VITE_SUPABASE_ANON_KEY'));
  assert.ok(!JSON.stringify(result).includes('never-disclose'));
});


test('diagnoses server-only configuration and conflicting project URLs without exposing values', () => {
  const env = { SUPABASE_URL: configured.VITE_SUPABASE_URL, SUPABASE_SECRET_KEY: configured.SUPABASE_SECRET_KEY };
  assert.equal(diagnoseConfiguration(env).services.discovery.configured, true);
  const result = diagnoseConfiguration({ ...env, VITE_SUPABASE_URL: 'https://other.supabase.co' });
  assert.equal(result.services.discovery.configured, false);
  assert.ok(result.services.discovery.missing.some(name => name.includes('conflicting projects')));
  assert.ok(!JSON.stringify(result).includes('https://other.supabase.co'));
});
