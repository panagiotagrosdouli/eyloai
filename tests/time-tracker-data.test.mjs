import test from 'node:test';
import assert from 'node:assert/strict';
import { durationSeconds, exportTimeEntriesCsv, loadAllTimeEntries, normalizeManualTimeEntry, summarizeTimeEntries } from '../src/lib/time-tracker-data.mjs';

test('manual time entries validate local times and normalize to UTC', () => {
  const value = normalizeManualTimeEntry({ description: '  Read papers  ', started_at: '2027-02-02T09:30', ended_at: '2027-02-02T10:15', timezone: 'Europe/Athens', project_id: 'p1' });
  assert.deepEqual(value, { description: 'Read papers', started_at: '2027-02-02T07:30:00.000Z', ended_at: '2027-02-02T08:15:00.000Z', project_id: 'p1', life_item_id: null });
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
