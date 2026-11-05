import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../supabase/migrations/' + path, import.meta.url), 'utf8');
const profileDDL = read('20260803_eylo_core_entities.sql');
const originalRPC = read('20260817090000_operational_services.sql');
const restrictedRPC = read('20260817090600_analytics_rpc_boundary.sql');
const smoke = read('20260817090700_analytics_smoke_verification.sql');

test('profile base schema uses user_id and JSONB data, not id or separate name columns', () => {
  const start = profileDDL.indexOf('create table if not exists public.profiles');
  assert.ok(start >= 0);
  const end = profileDDL.indexOf(');', start);
  const ddl = profileDDL.slice(start, end);
  assert.match(ddl, /user_id\s+uuid\s+primary key/i);
  assert.match(ddl, /data\s+jsonb\s+not null/i);
  assert.doesNotMatch(ddl, /\bid\s+uuid\b/i);
});

test('both analytics definitions read profile from JSONB using user_id', () => {
  for (const sql of [originalRPC, restrictedRPC]) {
    assert.match(sql, /nullif\(btrim\(data\s*->>\s*'organization'\),\s*''\)/i);
    assert.match(sql, /nullif\(btrim\(data\s*->>\s*'full_name'\),\s*''\)/i);
    assert.match(sql, /from public\.profiles\s+where user_id = requester/i);
    assert.doesNotMatch(sql, /from public\.profiles\s+where id = requester/i);
    assert.doesNotMatch(sql, /nullif\(organization,\s*''\)/i);
    assert.doesNotMatch(sql, /nullif\(full_name,\s*''\)/i);
  }
});

test('analytics smoke reads the existing primary key and timestamp', () => {
  assert.match(smoke, /select user_id into requester from public\.profiles order by created_date/i);
  assert.doesNotMatch(smoke, /select id into requester from public\.profiles/i);
});

test('the final analytics gateway retains least-privilege execution', () => {
  assert.match(restrictedRPC, /create or replace function private\.get_workspace_analytics_internal\(\)/i);
  assert.match(restrictedRPC, /security definer\s+set search_path = ''/i);
  assert.match(restrictedRPC, /revoke all on function private\.get_workspace_analytics_internal\(\) from public, anon/i);
  assert.match(restrictedRPC, /create or replace function public\.get_workspace_analytics\(\)/i);
  assert.match(restrictedRPC, /security invoker\s+set search_path = ''/i);
  assert.match(restrictedRPC, /revoke all on function public\.get_workspace_analytics\(\) from public, anon/i);
});
