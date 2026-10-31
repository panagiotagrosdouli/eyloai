import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readMigration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('analytics SQL reads profiles through the canonical user_id and JSONB data columns', async () => {
  const [schema, operational, boundary, correction] = await Promise.all([
    readMigration('20260803_eylo_core_entities.sql'),
    readMigration('20260817090000_operational_services.sql'),
    readMigration('20260817090600_analytics_rpc_boundary.sql'),
    readMigration('20261031105539_fix_analytics_profiles_and_service_role_grants.sql'),
  ]);

  assert.match(schema, /create table if not exists public\.profiles\s*\([\s\S]*?user_id uuid primary key[\s\S]*?data jsonb[\s\S]*?created_date timestamptz/i);
  for (const migration of [operational, boundary, correction]) {
    assert.match(migration, /profile\.user_id = requester/);
    assert.match(migration, /profile\.data ->> 'organization'/);
    assert.match(migration, /profile\.data ->> 'full_name'/);
    assert.doesNotMatch(migration, /where id = requester|nullif\(organization, ''\)|nullif\(full_name, ''\)/);
  }
});

test('analytics smoke migration selects the canonical profile key and timestamp', async () => {
  const migration = await readMigration('20260817090700_analytics_smoke_verification.sql');
  assert.match(migration, /select user_id into requester/);
  assert.match(migration, /order by created_date asc/);
  assert.doesNotMatch(migration, /select id into requester|order by created_at asc/);
});

test('monitoring tables explicitly grant backend service-role access', async () => {
  const migration = await readMigration('20261031105539_fix_analytics_profiles_and_service_role_grants.sql');
  assert.match(migration, /grant select, insert, update, delete\s+on public\.watchlists, public\.monitoring_discoveries, public\.notifications\s+to service_role;/i);
});
