import test from 'node:test';
import assert from 'node:assert/strict';
import { eventsForMonth, nextEventStart, normalizeCalendarEvent } from '../src/lib/calendar-domain.mjs';
import { readFile } from 'node:fs/promises';

const event = (patch = {}) => ({ title: 'Exam review', start_at: '2026-11-12T10:00:00Z', end_at: '2026-11-12T11:00:00Z', recurrence: 'none', ...patch });

test('calendar event normalization bounds fields and stores UTC instants', () => {
  assert.deepEqual(normalizeCalendarEvent(event({ start_at: '2026-11-12T12:00+02:00', end_at: '2026-11-12T13:30+02:00' })).start_at, '2026-11-12T10:00:00.000Z');
  assert.throws(() => normalizeCalendarEvent(event({ title: '  ' })), /title is required/i);
  assert.throws(() => normalizeCalendarEvent(event({ description: 'x'.repeat(4001) })), /4000 characters/i);
});

test('calendar events require valid timezone datetimes and positive duration', () => {
  assert.throws(() => normalizeCalendarEvent(event({ start_at: '2026-11-12T10:00' })), /timezone/i);
  assert.throws(() => normalizeCalendarEvent(event({ end_at: '2026-11-12T10:00:00Z' })), /after the start/i);
  assert.throws(() => normalizeCalendarEvent(event({ reminder_at: '2026-11-12T11:00:00Z' })), /before the event ends/i);
});

test('calendar event recurrence and project links accept only supported values', () => {
  assert.equal(normalizeCalendarEvent(event({ recurrence: 'weekly' })).recurrence, 'weekly');
  assert.throws(() => normalizeCalendarEvent(event({ project_id: 'not-a-uuid' })), /Project ID is invalid/i);
});

test('monthly recurring event dates clamp at month end', () => {
  assert.equal(nextEventStart('2026-01-31T10:00:00.000Z', 'monthly'), '2026-02-28T10:00:00.000Z');
  assert.equal(nextEventStart('2026-11-12T10:00:00.000Z', 'weekly'), '2026-11-19T10:00:00.000Z');
  assert.throws(() => nextEventStart('2026-11-12T10:00:00Z', 'none'), /frequency/i);
});

test('calendar month selector returns only events in month ordered by start', () => {
  const items = [event({ id: 'b', start_at: '2026-11-20T10:00:00Z' }), event({ id: 'a', start_at: '2026-11-01T10:00:00Z' }), event({ id: 'c', start_at: '2026-12-01T10:00:00Z' })];
  assert.deepEqual(eventsForMonth(items, 2026, 10).map(item => item.id), ['a', 'b']);
});

test('calendar persists events through owner-scoped RLS and validates project ownership', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261112173500_eylo_calendar_events.sql', import.meta.url), 'utf8');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.uid\(\).*user_id/s);
  assert.match(migration, /Event project must belong to its owner/i);
  assert.match(migration, /grant select, insert, update, delete on public\.calendar_events to authenticated/i);
});

test('calendar route is protected within the authenticated layout and repository is mapped', async () => {
  const [app, repository, ui] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Calendar.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*<Route path="\/calendar" element=\{<Calendar \/>\}/);
  assert.match(repository, /CalendarEvent: \{ table: 'calendar_events' \}/);
  assert.match(ui, /updateIfUnchanged/);
  assert.match(ui, /no external calendar sync is not connected|external calendar sync is not connected/i);
  assert.match(ui, /Add next occurrence/);
});
