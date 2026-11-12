import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20261112063310_discovery_rate_limits.sql', import.meta.url);

test('discovery limiter migration keeps counters private and exposes only a bounded service RPC', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create schema if not exists private/i);
  assert.match(sql, /alter table private\.discovery_rate_limit_counters enable row level security/i);
  assert.match(sql, /revoke all on table private\.discovery_rate_limit_counters from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table private\.discovery_rate_limit_counters to service_role/i);
  assert.match(sql, /security invoker\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.consume_discovery_rate_limit\(text, integer, integer, timestamptz\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.consume_discovery_rate_limit\(text, integer, integer, timestamptz\)\s+to service_role/i);
  assert.match(sql, /on conflict \(client_hash\) do update/i);
  assert.match(sql, /tokens = case/i);
  assert.match(sql, /least\([\s\S]*current_counter\.tokens[\s\S]*p_max_requests \/ p_window_seconds[\s\S]*\) - 1/i);
  assert.match(sql, /last_refill_at = greatest\(v_now, current_counter\.last_refill_at\)/i);
  assert.doesNotMatch(sql, /floor\(extract\(epoch from v_now\)/i);
  assert.match(sql, /create extension if not exists pg_cron/i);
  assert.match(sql, /cron\.schedule\([\s\S]*'eylo-discovery-rate-limit-cleanup'[\s\S]*'\*\/5 \* \* \* \*'/i);
  assert.match(sql, /where updated_at < clock_timestamp\(\) - interval '1 day'/i);
});
