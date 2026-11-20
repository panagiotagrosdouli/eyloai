import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('docs/release/supabase-applied-sql-fingerprints-2026-11-20.json', root), 'utf8'));
test('every applied remote SQL fingerprint is traceable to a reviewed local SQL file', () => {
  assert.equal(manifest.remote_application_authorized, false);
  assert.equal(manifest.items.length, 19);
  assert.equal(new Set(manifest.items.map(item => item.remote_version)).size, 19);
  assert.equal(new Set(manifest.items.map(item => item.local_file)).size, 19);
  const exact = manifest.items.filter(item => item.classification === 'exact_sql_match');
  const divergent = manifest.items.filter(item => item.classification === 'divergent_sql_requires_review');
  assert.equal(exact.length, 18);
  assert.deepEqual(divergent.map(item => item.remote_name), ['security_hardening']);
  for (const item of manifest.items) {
    assert.match(item.remote_version, /^\d{14}$/);
    assert.match(item.local_file, /^\d{8,14}_[a-z0-9_]+\.sql$/);
    assert.match(item.remote_md5, /^[0-9a-f]{32}$/);
    const source = readFileSync(new URL('supabase/migrations/' + item.local_file, root), 'utf8');
    const localFingerprint = createHash('md5').update(source).digest('hex');
    assert.equal(localFingerprint === item.remote_md5, item.classification === 'exact_sql_match', item.local_file);
  }
});
test('the historical profiles RLS policy divergence remains explicitly blocked for review', () => {
  const item = manifest.items.find(row => row.remote_name === 'security_hardening');
  assert.equal(item.classification, 'divergent_sql_requires_review');
  const local = readFileSync(new URL('supabase/migrations/' + item.local_file, root), 'utf8');
  assert.match(local, /auth\.uid\(\)\) = user_id/);
});
