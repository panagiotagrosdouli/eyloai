import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel Hobby deployment remains at or below its 12 function ceiling', () => {
  const apiDir = new URL('../api/', import.meta.url);
  const functions = readdirSync(apiDir).filter(name => /\.(?:js|mjs|ts)$/.test(name));
  assert.ok(functions.length <= 12, `Detected ${functions.length} API functions, exceeding Vercel Hobby 12-function limit: ${functions.join(', ')}`);
  assert.ok(functions.includes('system.js'));
  assert.ok(!functions.includes('admin-analytics.js'));
});

test('legacy Analytics URL rewrites to protected system endpoint, preserving CORS, auth and no-cache', () => {
  const rewritten = vercel.rewrites.find(item => item.source === '/api/admin-analytics');
  assert.deepEqual(rewritten, {
    source: '/api/admin-analytics',
    destination: '/api/system?endpoint=admin-analytics',
  });
  const router = readFileSync(new URL('../api/system.js', import.meta.url), 'utf8');
  const endpoint = readFileSync(new URL('../server/admin-analytics.js', import.meta.url), 'utf8');
  assert.match(router, /'admin-analytics': adminAnalytics/);
  assert.match(endpoint, /applyCors\(request, response, \["GET"\]\)/);
  assert.match(endpoint, /'Cache-Control', 'private, no-store'/);
  assert.match(endpoint, /authorization = request\.headers\?\.authorization/);
});
