import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import monitor from '../api/monitor.js';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

function responseMock() {
  return {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('Vercel schedules real server-side monitoring without an open browser', () => {
  assert.deepEqual(config.crons, [{ path: '/api/monitor', schedule: '0 8 * * *' }]);
});

test('scheduled monitor refuses unauthenticated invocations', async () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'private-test-secret';
  try {
    const response = responseMock();
    await monitor({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.payload.error, 'Cron authorization required.');
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test('monitoring releases an in-run deduplication key after a failed database insert', () => {
  const source = readFileSync(new URL('../api/monitor.js', import.meta.url), 'utf8');
  assert.match(source, /seen\.add\(key\);[\s\S]*?await supabase\('monitoring_discoveries'[\s\S]*?catch \(error\) \{[\s\S]*?seen\.delete\(key\);\s*throw error;/);
});

test('monitoring reports partial failures instead of silently claiming full success', () => {
  const source = readFileSync(new URL('../api/monitor.js', import.meta.url), 'utf8');
  assert.match(source, /partial_failure: failed > 0/);
  assert.match(source, /console\.error\('Watchlist monitoring failed'/);
});

test('monitoring handles overlapping-worker database uniqueness conflicts', () => {
  const source = readFileSync(new URL('../api/monitor.js', import.meta.url), 'utf8');
  assert.match(source, /status: response\.status/);
  assert.match(source, /if \(error\?\.status === 409\) continue;/);
});

test('database migration enforces a unique source ID per account', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20261017090000_monitoring_discovery_uniqueness.sql', import.meta.url), 'utf8',
  );
  assert.match(sql, /create unique index if not exists monitoring_discoveries_user_source_unique/);
  assert.match(sql, /on public\.monitoring_discoveries/);
  assert.match(sql, /user_id,/);
  assert.match(sql, /external_id/);
});

test('scheduler gets retryable HTTP status when any watchlist fails', () => {
  const source = readFileSync(new URL('../api/monitor.js', import.meta.url), 'utf8');
  assert.match(source, /response\.status\(failed > 0 \? 503 : 200\)\.json\(/);
  assert.match(source, /partial_failure: failed > 0/);
});

test('monitoring reports the specific failed watchlist and excludes inactive ones from checked', async () => {
  const previousFetch = globalThis.fetch;
  const oldSecret = process.env.CRON_SECRET;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_placeholder';
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.includes('/rest/v1/watchlists?select=')) {
      return new Response(JSON.stringify([
        { id: 'watch-failed', user_id: 'user-1', data: { active: true, query: 'quantum computing' } },
        { id: 'watch-disabled', user_id: 'user-1', data: { active: false, query: 'inactive' } },
      ]), { status: 200 });
    }
    if (address.includes('/rest/v1/monitoring_discoveries?select=')) {
      return new Response('[]', { status: 200 });
    }
    if (address.includes('api.openalex.org/works')) {
      return new Response('{}', { status: 400 });
    }
    throw new Error('Unexpected monitoring request: ' + address);
  };
  try {
    const response = responseMock();
    await monitor({ method: 'GET', headers: { authorization: 'Bearer test-cron-secret' } }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.payload.checked, 1);
    assert.equal(response.payload.skipped, 1);
    assert.equal(response.payload.failed, 1);
    assert.deepEqual(response.payload.failed_watchlist_ids, ['watch-failed']);
    assert.equal(response.payload.partial_failure, true);
  } finally {
    globalThis.fetch = previousFetch;
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

test('monitoring retains failure state and clears consecutive failures after success', () => {
  const source = readFileSync(new URL('../api/monitor.js', import.meta.url), 'utf8');
  assert.match(source, /lastCheckStatus: 'failed'/);
  assert.match(source, /lastFailedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(source, /consecutiveFailures: Number\(row\.data\?\.consecutiveFailures \|\| 0\) \+ 1/);
  assert.match(source, /lastCheckStatus: 'success'/);
  assert.match(source, /consecutiveFailures: 0/);
  assert.match(source, /Could not persist watchlist failure status/);
});
