import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/system/ServiceStatus.jsx', import.meta.url), 'utf8');

test('workspace status probes its own deployed SHA without caching or exposing credentials', () => {
  assert.match(source, /fetch\('\/api\/deployment-status', \{ method: 'GET', cache: 'no-store', signal: controller\.signal \}\)/);
  assert.match(source, /provenance_verified/);
  assert.match(source, /\^\[a-f0-9\]\{40\}\$/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|OPENAI_API_KEY/);
});

test('workspace differentiates a Git revision from actual provider operation', () => {
  assert.match(source, /Git identity only; not proof that services work/);
  assert.match(source, /did not report a Git revision/);
  assert.match(source, /Deployed revision/);
});
