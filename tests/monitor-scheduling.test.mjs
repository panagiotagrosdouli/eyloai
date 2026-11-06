import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monitorWatchlistsQuery, MAX_WATCHLISTS_PER_RUN } from '../src/lib/monitor-scheduling.mjs';

test('inactive JSON watchlists are filtered before the 30-row cap', () => {
  const path = monitorWatchlistsQuery();
  const url = new URL('https://example.test/rest/v1/' + path);
  assert.equal(url.pathname, '/rest/v1/watchlists');
  assert.equal(url.searchParams.get('limit'), '30');
  assert.equal(url.searchParams.get('or'), '(data->>active.is.null,data->>active.neq.false)');
  assert.equal(url.searchParams.get('order'), 'updated_date.asc,id.asc');
  assert.equal(url.searchParams.get('select'), 'id,user_id,data');
  assert.ok(MAX_WATCHLISTS_PER_RUN <= 30);
  const source = readFileSync(new URL('../api/monitor.js', import.meta.url), 'utf8');
  assert.match(source, /supabase\(monitorWatchlistsQuery\(\)\)/);
  assert.doesNotMatch(source, /order=updated_date\.asc&limit=/);
});

test('legacy watchlists missing active flag stay eligible; deterministic oldest-first ordering', () => {
  const url = new URL('https://example.test/rest/v1/' + monitorWatchlistsQuery(5));
  const expr = url.searchParams.get('or');
  assert.match(expr, /active\.is\.null/);
  assert.match(expr, /active\.neq\.false/);
  assert.equal(url.searchParams.get('limit'), '5');
  assert.equal(url.searchParams.get('order'), 'updated_date.asc,id.asc');
  assert.throws(() => monitorWatchlistsQuery(31), /Invalid/);
  assert.throws(() => monitorWatchlistsQuery(0), /Invalid/);
  assert.throws(() => monitorWatchlistsQuery('5'), /Invalid/);
});

test('watchlist schema auto-updates ordering column on PATCH so processed rows rotate', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260803_eylo_monitoring_entities.sql', import.meta.url), 'utf8');
  assert.match(sql, /create trigger %I before update on public\.%I for each row execute function public\.set_updated_date\(\)/);
  const core = readFileSync(new URL('../supabase/migrations/20260803_eylo_core_entities.sql', import.meta.url), 'utf8');
  assert.match(core, /new\.updated_date = timezone\('utc', now\(\)\)/);
});
