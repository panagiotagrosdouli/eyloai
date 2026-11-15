import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production smoke includes every public marketing and account entry route', async () => {
  const smoke = await readFile(new URL('../scripts/smoke-public.mjs', import.meta.url), 'utf8');
  for (const route of [
    '/', '/discover', '/find-researchers', '/careers', '/company',
    '/company/what-we-do', '/plans', '/contact', '/login', '/register',
    '/forgot-password', '/reset-password', '/auth/callback',
  ]) {
    assert.ok(smoke.includes(`path: '${route}'`), `Missing smoke coverage: ${route}`);
  }
  assert.match(smoke, /redirect: 'manual'/);
  assert.match(smoke, /signal: controller\.signal/);
});

test('contact form bounds network wait and keeps retry messaging safe', async () => {
  const page = await readFile(new URL('../src/pages/Contact.jsx', import.meta.url), 'utf8');
  assert.match(page, /fetch\(apiUrl\("\/api\/contact"\)/);
  assert.match(page, /signal: AbortSignal\.timeout\(15000\)/);
  assert.match(page, /error\?\.name === "TimeoutError"/);
  assert.match(page, /your previous message may have been delivered/);
});
