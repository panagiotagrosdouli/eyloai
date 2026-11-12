import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDatetimeLocal, nextCalendarOccurrence, normalizeCalendarEvent, toDatetimeLocal, visibleCalendarEvents } from '../src/lib/calendar-data.mjs';

test('calendar input normalizes event metadata and preserves selected time zone', () => {
  assert.deepEqual(normalizeCalendarEvent({
    title: '  Thesis exam ', description: ' Read chapter 4 ', subject: ' Research methods ', status: 'scheduled', event_type: 'exam',
    starts_at: '2027-02-02T09:30', timezone: 'Europe/Athens', recurrence: 'weekly',
    reminder_minutes: '30', project_id: 'project-1',
  }), {
    title: 'Thesis exam', description: 'Read chapter 4', subject: 'Research methods', status: 'scheduled', event_type: 'exam',
    starts_at: '2027-02-02T07:30:00.000Z', timezone: 'Europe/Athens',
    recurrence: 'weekly', reminder_minutes: 30, project_id: 'project-1',
  });
});

test('calendar input rejects missing title, invalid dates, recurrence, timezone, and reminder range', () => {
  const valid = { title: 'Review', starts_at: '2027-02-02T09:30', timezone: 'UTC' };
  assert.throws(() => normalizeCalendarEvent({ ...valid, title: '' }), /Title/);
  assert.throws(() => normalizeCalendarEvent({ ...valid, starts_at: 'invalid' }), /date and time/);
  assert.throws(() => normalizeCalendarEvent({ ...valid, recurrence: 'hourly' }), /repeat schedule/);
  assert.throws(() => normalizeCalendarEvent({ ...valid, timezone: 'Mars/Olympus' }), /time zone/);
  assert.throws(() => normalizeCalendarEvent({ ...valid, reminder_minutes: '0' }), /Reminder/);
});

test('local datetime formatting accounts for browser offset and invalid dates', () => {
  assert.equal(toDatetimeLocal('not-a-date'), '');
  assert.match(toDatetimeLocal('2027-02-02T09:30:00.000Z'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(fromDatetimeLocal('2027-02-02T09:30', 'Europe/Athens'), '2027-02-02T07:30:00.000Z');
  assert.equal(toDatetimeLocal('2027-02-02T07:30:00.000Z', 'Europe/Athens'), '2027-02-02T09:30');
  assert.throws(() => fromDatetimeLocal('2027-03-28T03:30', 'Europe/Athens'), /does not exist/);
});

test('calendar list separates past and upcoming real events', () => {
  const now = Date.parse('2027-01-01T12:00:00Z');
  const events = [
    { id: 'later', starts_at: '2027-01-02T12:00:00Z' },
    { id: 'earlier', starts_at: '2027-01-01T11:00:00Z' },
  ];
  assert.deepEqual(visibleCalendarEvents(events, 'upcoming', now).map(item => item.id), ['later']);
  assert.deepEqual(visibleCalendarEvents(events, 'past', now).map(item => item.id), ['earlier']);
  assert.deepEqual(visibleCalendarEvents(events, 'all', now).map(item => item.id), ['earlier', 'later']);
});

test('recurring calendar entries expose their next local-time occurrence', () => {
  const now = Date.parse('2027-01-01T10:00:00.000Z');
  assert.equal(nextCalendarOccurrence({ starts_at: '2027-01-01T08:00:00.000Z', timezone: 'UTC', recurrence: 'daily' }, now), Date.parse('2027-01-02T08:00:00.000Z'));
  assert.equal(nextCalendarOccurrence({ starts_at: '2027-01-01T08:00:00.000Z', timezone: 'UTC', recurrence: 'weekly' }, Date.parse('2027-01-05T12:00:00.000Z')), Date.parse('2027-01-08T08:00:00.000Z'));
  assert.equal(nextCalendarOccurrence({ starts_at: '2027-01-31T09:00:00.000Z', timezone: 'UTC', recurrence: 'monthly' }, Date.parse('2027-02-01T12:00:00.000Z')), Date.parse('2027-02-28T09:00:00.000Z'));
});
