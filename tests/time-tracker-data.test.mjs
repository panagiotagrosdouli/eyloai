import test from 'node:test';
import assert from 'node:assert/strict';
import { durationSeconds, exportTimeEntriesCsv, loadAllTimeEntries, normalizeManualTimeEntry, summarizeTimeEntries } from '../src/lib/time-tracker-data.mjs';

test('manual time entries validate local times and normalize to UTC', () => {
  const value = normalizeManualTimeEntry({ description: '  Read papers  ', started_at: '2027-02-02T09:30', ended_at: '2027-02-02T10:15', timezone: 'Europe/Athens', project_id: 'p1' });
  assert.deepEqual(value, { description: 'Read papers', started_at: '2027-02-02T07:30:00.000Z', ended_at: '2027-02-02T08:15:00.000Z', project_id: 'p1', life_task_id: null });
  assert.throws(() => normalizeManualTimeEntry({ description: '  ', started_at: 'x', ended_at: 'y', timezone: 'UTC' }), /1–500/);
  assert.throws(() => normalizeManualTimeEntry({ description: 'Work', started_at: '2027-02-02T10:00', ended_at: '2027-02-02T09:00', timezone: 'UTC' }), /after/);
  assert.throws(() => normalizeManualTimeEntry({ description: 'Work', started_at: '2027-03-28T03:30', ended_at: '2027-03-28T04:30', timezone: 'Europe/Athens' }), /does not exist/);
});

test('duration handles running, malformed and negative intervals', () => {
  assert.equal(durationSeconds({ started_at: '2027-01-01T00:00:00Z', ended_at: null }, Date.parse('2027-01-01T00:02:05Z')), 125);
  assert.equal(durationSeconds({ started_at: 'bad', ended_at: null }, Date.now()), 0);
  assert.equal(durationSeconds({ started_at: '2027-01-02T00:00:00Z', ended_at: '2027-01-01T00:00:00Z' }), 0);
});

test('reports clip work to local today and Monday-based week boundaries', () => {
  const now = new Date('2027-01-05T18:00:00Z'); // Tuesday, 13:00 in New York
  const result = summarizeTimeEntries([
    { started_at: '2027-01-04T23:00:00Z', ended_at: '2027-01-05T19:00:00Z', project_id: 'p1' },
    { started_at: '2027-01-03T12:00:00Z', ended_at: '2027-01-03T13:00:00Z', project_id: 'p2' },
  ], { now, timezone: 'America/New_York' });
  assert.equal(result.todaySeconds, 13 * 3600);
  assert.equal(result.weekSeconds, 19 * 3600);
  assert.deepEqual(result.byProject.map(({ project_id, seconds }) => [project_id, seconds]), [['p1', 20 * 3600], ['p2', 3600]]);
});

test('CSV export quotes values and neutralizes formula injection', () => {
  const csv = exportTimeEntriesCsv([{ description: ' =SUM(A1:A2)', started_at: '2027-01-01T00:00:00Z', ended_at: '2027-01-01T00:00:01Z' }]);
  assert.match(csv, /"' =SUM\(A1:A2\)"/);
  assert.match(csv, /"duration_seconds"/);
});

test('time export paginates, checks owner scope, and propagates failures', async () => {
  const pages = [[{ id: '1', user_id: 'u1' }, { id: '2', user_id: 'u1' }], [{ id: '3', user_id: 'u1' }]];
  let requested = 0;
  const fakeClient = result => ({ from: () => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => result() };
    return query;
  } });
  const client = fakeClient(() => ({ data: pages[requested++] }));
  assert.equal((await loadAllTimeEntries(client, 'u1', 2, 10)).length, 3);
  const foreignClient = fakeClient(() => ({ data: [{ user_id: 'u2' }] }));
  await assert.rejects(loadAllTimeEntries(foreignClient, 'u1', 2, 10), /another account/);
  const errorClient = fakeClient(() => ({ error: new Error('backend unavailable') }));
  await assert.rejects(loadAllTimeEntries(errorClient, 'u1', 2, 10), /backend unavailable/);
});

test('time export accepts an exact safety limit only after checking for extra records', async () => {
  let calls = 0;
  const exactClient = { from: () => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => {
      calls += 1;
      return calls === 1 ? { data: [{ id: '1', user_id: 'u1' }, { id: '2', user_id: 'u1' }] } : { data: [] };
    } };
    return query;
  } };
  assert.equal((await loadAllTimeEntries(exactClient, 'u1', 2, 2)).length, 2);
  const overflowClient = { from: () => {
    let callsForClient = 0;
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => {
      callsForClient += 1;
      return callsForClient === 1 ? { data: [{ id: '1', user_id: 'u1' }, { id: '2', user_id: 'u1' }] } : { data: [{ id: '3' }] };
    } };
    return query;
  } };
  await assert.rejects(loadAllTimeEntries(overflowClient, 'u1', 2, 2), /safety limit/);
});

test('complete history includes old running timers beyond the first thousand entries', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i), user_id: 'u1', project_id: 'p1',
    started_at: '2027-01-04T10:00:00Z', ended_at: '2027-01-04T10:01:00Z',
  }));
  rows.push({ id: 'active', user_id: 'u1', started_at: '2027-01-04T09:00:00Z', ended_at: null });
  const ranges = [];
  const client = { from: () => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; },
      async range(start, end) { ranges.push([start, end]); return { data: rows.slice(start, end + 1) }; } };
    return query;
  } };
  const history = await loadAllTimeEntries(client, 'u1');
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  assert.equal(history.find(entry => entry.ended_at === null)?.id, 'active');
  const summary = summarizeTimeEntries(history, { now: new Date('2027-01-04T11:00:00Z') });
  assert.equal(summary.totalSeconds, 1001 * 60 + 7200);
  assert.equal(summary.todaySeconds, summary.totalSeconds);
});

test('non-aligned history safety limits never load or silently accept extra records', async () => {
  for (const count of [3, 4]) {
    const rows = Array.from({ length: count }, (_, i) => ({ id: String(i), user_id: 'u1' }));
    const ranges = [];
    const client = { from: () => {
      const query = { select() { return this; }, eq() { return this; }, order() { return this; },
        async range(start, end) { ranges.push([start, end]); return { data: rows.slice(start, end + 1) }; } };
      return query;
    } };
    if (count === 3) assert.equal((await loadAllTimeEntries(client, 'u1', 2, 3)).length, 3);
    else await assert.rejects(loadAllTimeEntries(client, 'u1', 2, 3), /safety limit/);
    assert.deepEqual(ranges, [[0, 1], [2, 2], [3, 3]]);
  }
});

test('CSV running durations use a reproducible snapshot timestamp', () => {
  const csv = exportTimeEntriesCsv([{ description: 'Research', started_at: '2027-01-01T00:00:00Z', ended_at: null }], Date.parse('2027-01-01T00:02:05Z'));
  assert.match(csv, /"125","\[\]"\r\n$/);
});

test('a later history page failure rejects the whole report instead of returning partial totals', async () => {
  let calls = 0;
  const client = { from: () => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; },
      async range() {
        calls++;
        return calls === 1 ? { data: [{ id: '1', user_id: 'u1' }, { id: '2', user_id: 'u1' }] }
          : { error: new Error('page timeout') };
      } };
    return query;
  } };
  await assert.rejects(loadAllTimeEntries(client, 'u1', 2, 10), /page timeout/);
  assert.equal(calls, 2);
});

test('pauses persist and are excluded from completed and ongoing durations', async () => {
  const { isTimeEntryPaused } = await import('../src/lib/time-tracker-data.mjs');
  const entry = { started_at: '2027-01-04T09:00:00Z', ended_at: null, pause_intervals: [
    { started_at: '2027-01-04T09:30:00Z', ended_at: '2027-01-04T10:00:00Z' },
    { started_at: '2027-01-04T10:15:00Z', ended_at: null },
  ] };
  assert.equal(isTimeEntryPaused(entry), true);
  assert.equal(durationSeconds(entry, Date.parse('2027-01-04T11:00:00Z')), 45 * 60);
  assert.equal(durationSeconds(JSON.parse(JSON.stringify(entry)), Date.parse('2027-01-04T15:00:00Z')), 45 * 60);
  const stopped = { ...entry, ended_at: '2027-01-04T11:00:00Z', pause_intervals: [entry.pause_intervals[0], { ...entry.pause_intervals[1], ended_at: '2027-01-04T11:00:00Z' }] };
  assert.equal(isTimeEntryPaused(stopped), false);
  assert.equal(durationSeconds(stopped), 45 * 60);
});

test('day and week reports subtract only the paused portion inside each boundary', () => {
  const now = new Date('2027-01-04T02:00:00Z'); // Monday UTC
  const entry = { started_at: '2027-01-03T22:00:00Z', ended_at: null, pause_intervals: [
    { started_at: '2027-01-03T23:00:00Z', ended_at: '2027-01-04T01:00:00Z' },
  ] };
  const report = summarizeTimeEntries([entry], { now, timezone: 'UTC' });
  assert.equal(report.todaySeconds, 3600);
  assert.equal(report.weekSeconds, 3600);
  assert.equal(report.totalSeconds, 7200);
  assert.equal(report.byProject[0].seconds, 7200);
});

test('overlapping, out-of-range and malformed pause intervals fail explicitly', () => {
  const entry = { started_at: '2027-01-04T09:00:00Z', ended_at: '2027-01-04T11:00:00Z' };
  for (const pauses of [null, {}, [{ started_at: 'bad', ended_at: null }], [
    { started_at: '2027-01-04T09:30:00Z', ended_at: '2027-01-04T10:30:00Z' },
    { started_at: '2027-01-04T10:00:00Z', ended_at: '2027-01-04T11:00:00Z' },
  ], [{ started_at: '2027-01-04T08:30:00Z', ended_at: '2027-01-04T10:00:00Z' }]]) {
    if (pauses === null) continue; // Legacy entries without pause metadata remain compatible.
    assert.throws(() => durationSeconds({ ...entry, pause_intervals: pauses }), /Invalid timer pause history/);
  }
});

test('timer RPC submits revisions and rejects unavailable, foreign and unconfirmed results', async () => {
  const { transitionTimeEntry } = await import('../src/lib/time-tracker-data.mjs');
  const entry = { id: 'timer', user_id: 'u1', timer_revision: 2, ended_at: null };
  const paused = { ...entry, timer_revision: 3, pause_intervals: [{ started_at: '2027-01-04T09:30:00Z', ended_at: null }] };
  let args;
  const client = { async rpc(name, payload) { args = [name, payload]; return { data: paused }; } };
  assert.deepEqual(await transitionTimeEntry(client, entry, 'u1', 'pause'), paused);
  assert.deepEqual(args, ['transition_time_entry', { p_entry_id: 'timer', p_action: 'pause', p_expected_revision: 2 }]);
  await assert.rejects(transitionTimeEntry(client, entry, 'u2', 'stop'), /access denied/);
  await assert.rejects(transitionTimeEntry(client, entry, 'u1', 'delete'), /access denied/);
  await assert.rejects(transitionTimeEntry({ rpc: async () => ({ error: { code: 'PGRST202' } }) }, entry, 'u1', 'pause'), /database migration/);
  await assert.rejects(transitionTimeEntry({ rpc: async () => ({ error: new Error('stale revision') }) }, entry, 'u1', 'pause'), /stale revision/);
  for (const data of [null, [], { ...paused, user_id: 'u2' }, { ...paused, id: 'other' }, { ...paused, timer_revision: 2 }, entry]) {
    await assert.rejects(transitionTimeEntry({ rpc: async () => ({ data }) }, entry, 'u1', 'pause'), /could not be verified/);
  }
});

test('a small server/client clock difference does not break a newly paused timer', () => {
  const entry = { started_at: '2027-01-04T09:00:00Z', ended_at: null, pause_intervals: [{ started_at: '2027-01-04T09:30:01Z', ended_at: null }] };
  assert.equal(durationSeconds(entry, Date.parse('2027-01-04T09:30:00Z')), 1800);
});

test('historical reports clip pauses to inclusive local dates across DST', async () => {
  const { createTimeReport, exportTimeReportCsv } = await import('../src/lib/time-tracker-data.mjs');
  const entry = { description: '=work', project_id: 'p1', started_at: '2027-03-27T20:00:00Z', ended_at: '2027-03-29T02:00:00Z', pause_intervals: [
    { started_at: '2027-03-28T00:30:00Z', ended_at: '2027-03-28T02:30:00Z' },
  ] };
  const report = createTimeReport([entry], { fromDate: '2027-03-28', toDate: '2027-03-28', timezone: 'Europe/Athens', now: Date.parse('2027-03-30T00:00:00Z') });
  assert.equal(report.started_at, '2027-03-27T22:00:00.000Z');
  assert.equal(report.ended_at, '2027-03-28T21:00:00.000Z');
  assert.equal(report.totalSeconds, 21 * 3600); // 23-hour day, minus two paused hours.
  assert.deepEqual(report.byProject, [{ project_id: 'p1', seconds: 21 * 3600 }]);
  assert.match(exportTimeReportCsv(report), /"'=work"/);
  assert.match(exportTimeReportCsv(report), /"75600"/);
  assert.throws(() => createTimeReport([], { fromDate: '2027-02-30', toDate: '2027-03-01' }), /valid date/);
  assert.throws(() => createTimeReport([], { fromDate: '2027-03-02', toDate: '2027-03-01' }), /on or after/);
  assert.throws(() => createTimeReport([], { fromDate: '', toDate: '2027-03-01' }), /valid report dates/);
});

test('legacy timers stop without the optional migration using owner and version guards', async () => {
  const { transitionTimeEntry } = await import('../src/lib/time-tracker-data.mjs');
  const entry = { id: 'legacy', user_id: 'u1', started_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z', ended_at: null };
  const predicates = [];
  let patch;
  const query = { update(value) { patch = value; return this; }, eq(key, value) { predicates.push([key, value]); return this; }, is(key, value) { predicates.push([key, value]); return this; }, select() { return this; }, async maybeSingle() { return { data: { ...entry, ...patch } }; } };
  const client = { from(table) { assert.equal(table, 'time_entries'); return query; }, rpc() { assert.fail('legacy stop must not require the migration'); } };
  const saved = await transitionTimeEntry(client, entry, 'u1', 'stop');
  assert.ok(saved.ended_at);
  assert.deepEqual(predicates, [['id','legacy'],['user_id','u1'],['started_at',entry.started_at],['updated_at',entry.updated_at],['ended_at',null]]);
  query.maybeSingle = async () => ({ data: null });
  await assert.rejects(transitionTimeEntry(client, entry, 'u1', 'stop'), /changed in another tab/);
  query.maybeSingle = async () => ({ error: new Error('storage unavailable') });
  await assert.rejects(transitionTimeEntry(client, entry, 'u1', 'stop'), /storage unavailable/);
  query.maybeSingle = async () => ({ data: { ...entry, ...patch, user_id: 'u2' } });
  await assert.rejects(transitionTimeEntry(client, entry, 'u1', 'stop'), /could not be verified/);
  await assert.rejects(transitionTimeEntry(client, entry, 'u2', 'stop'), /access denied/);
});

test('migrated timers never bypass a missing or denied transition RPC', async () => {
  const { transitionTimeEntry } = await import('../src/lib/time-tracker-data.mjs');
  const entry = { id: 'migrated', user_id: 'u1', timer_revision: 0, pause_intervals: [], ended_at: null };
  const client = { from() { assert.fail('migrated stops must not fall back to a direct write'); }, rpc: async () => ({ error: { code: 'PGRST202' } }) };
  await assert.rejects(transitionTimeEntry(client, entry, 'u1', 'stop'), /database migration/);
  client.rpc = async () => ({ error: { code: '42501', message: 'access denied' } });
  await assert.rejects(transitionTimeEntry(client, entry, 'u1', 'stop'), error => error.code === '42501' && error.message === 'access denied');
});
