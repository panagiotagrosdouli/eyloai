import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const config = JSON.parse(read('vercel.json'));
const responseHeaders = Object.fromEntries(config.headers.flatMap(rule => rule.headers.map(({ key, value }) => [key.toLowerCase(), value])));

test('all deployed Vercel routes have baseline security response headers', () => {
  assert.ok(config.headers.some(rule => rule.source === '/(.*)'));
  assert.match(responseHeaders['strict-transport-security'], /max-age=\d+/);
  assert.equal(responseHeaders['x-content-type-options'], 'nosniff');
  assert.equal(responseHeaders['x-frame-options'], 'DENY');
  assert.equal(responseHeaders['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.match(responseHeaders['content-security-policy'], /object-src 'none'/);
  assert.match(responseHeaders['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(responseHeaders['content-security-policy'], /base-uri 'self'/);
  assert.match(responseHeaders['content-security-policy'], /upgrade-insecure-requests/);
});

test('Vercel never proxies credentials to a fixed Supabase project', () => {
  assert.ok(config.rewrites.every(rule => !rule.source.startsWith('/supabase')));
  assert.ok(config.rewrites.every(rule => !String(rule.destination).includes('.supabase.co')));
  const source = read('src/lib/supabaseClient.js');
  assert.match(source, /const supabaseUrl = environment\.values\.VITE_SUPABASE_URL/);
  assert.doesNotMatch(source, /gatewayProjectUrl|gatewayFetch|allowGateway/);
});
