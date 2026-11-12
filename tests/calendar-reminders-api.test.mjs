import test from 'node:test';
import assert from 'node:assert/strict';
import { runCalendarReminderDispatch } from '../src/lib/calendar-reminders-api.mjs';

const env = {
  CRON_SECRET: 'fixture-cron-secret',
  VITE_SUPABASE_URL: 'https://eylo-test.supabase.co',
  SUPABASE_SECRET_KEY: 'fixture-service-key',
};

test('calendar reminder dispatch rejects missing or incorrect cron authorization without network access', async () => {
  let fetched = false;
  const result = await runCalendarReminderDispatch({ env, authorization: 'Bearer wrong', fetchImpl: async () => { fetched = true; } });
  assert.equal(result.status, 401);
  assert.equal(fetched, false);
});

test('calendar reminder dispatch fails closed when project credentials are absent', async () => {
  let fetched = false;
  const result = await runCalendarReminderDispatch({
    env: { CRON_SECRET: env.CRON_SECRET }, authorization: `Bearer ${env.CRON_SECRET}`,
    fetchImpl: async () => { fetched = true; },
  });
  assert.equal(result.status, 503);
  assert.equal(fetched, false);
});

test('authorized dispatch calls only the configured project RPC and reports its count', async () => {
  let request;
  const result = await runCalendarReminderDispatch({
    env, authorization: `Bearer ${env.CRON_SECRET}`,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => 3 };
    },
  });
  assert.equal(request.url, 'https://eylo-test.supabase.co/rest/v1/rpc/dispatch_calendar_reminders');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.apikey, 'fixture-service-key');
  assert.equal(result.status, 200);
  assert.equal(result.body.dispatched, 3);
});

test('provider and malformed RPC failures are not reported as successful dispatches', async () => {
  const makeCall = fetchImpl => runCalendarReminderDispatch({ env, authorization: `Bearer ${env.CRON_SECRET}`, fetchImpl });
  assert.equal((await makeCall(async () => ({ ok: false, status: 500 }))).status, 502);
  assert.equal((await makeCall(async () => ({ ok: true, json: async () => 'bad' }))).status, 502);
  assert.equal((await makeCall(async () => ({ ok: true, json: async () => null }))).status, 502);
  assert.equal((await makeCall(async () => ({ ok: true, json: async () => true }))).status, 502);
  assert.equal((await makeCall(async () => { throw new Error('offline'); })).status, 502);
});
