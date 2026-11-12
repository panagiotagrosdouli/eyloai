import test from 'node:test';
import assert from 'node:assert/strict';
import { habitDateInTimezone, normalizeLifeItem, validateLifePlanSuggestions } from '../src/lib/life-data.mjs';

test('life items normalize actual goal, task, project, progress, and time-zone data', () => {
  const value = normalizeLifeItem({
    item_type: 'task', title: '  Draft methods  ', description: ' notes ',
    due_at: '2027-02-02T09:30', reminder_minutes: '30', timezone: 'Europe/Athens', cadence: 'weekly',
    progress: '25', project_id: 'project-1', parent_id: 'goal-1',
  });
  assert.deepEqual(value, {
    item_type: 'task', title: 'Draft methods', description: 'notes',
    timezone: 'Europe/Athens', cadence: 'weekly', progress: 25,
    due_at: '2027-02-02T07:30:00.000Z', reminder_minutes: 30, project_id: 'project-1', parent_id: 'goal-1', status: 'active',
  });
});

test('life data rejects invalid types, percentages, hierarchy, cadence, and time zones', () => {
  const valid = { title: 'Target', timezone: 'UTC' };
  assert.throws(() => normalizeLifeItem({ ...valid, item_type: 'unknown' }), /item type/);
  assert.throws(() => normalizeLifeItem({ ...valid, progress: '101' }), /0 and 100/);
  assert.throws(() => normalizeLifeItem({ ...valid, item_type: 'goal', parent_id: 'another' }), /cannot be a child/);
  assert.throws(() => normalizeLifeItem({ ...valid, item_type: 'habit' }), /cadence/);
  assert.throws(() => normalizeLifeItem({ ...valid, timezone: 'Mars/Olympus' }), /time zone/);
  assert.throws(() => normalizeLifeItem({ ...valid, status: 'deleted' }), /status/);
  assert.throws(() => normalizeLifeItem({ ...valid, reminder_minutes: '30' }), /due date/);
  assert.throws(() => normalizeLifeItem({ ...valid, item_type: 'goal', due_at: '2027-02-02T09:30', reminder_minutes: '30' }), /available for tasks/);
});

test('AI plan suggestions are validated, bounded, and deduplicated before user review', () => {
  assert.deepEqual(validateLifePlanSuggestions([
    { title: 'Read methods', description: 'Review chapter two.' },
    { title: ' read METHODS ', description: 'A duplicate suggestion.' },
    { title: 'Write outline', description: 'Draft headings.' },
  ]), [
    { title: 'Read methods', description: 'Review chapter two.', item_type: 'task' },
    { title: 'Write outline', description: 'Draft headings.', item_type: 'task' },
  ]);
  assert.throws(() => validateLifePlanSuggestions([{ title: '', description: '' }]), /invalid/);
  assert.throws(() => validateLifePlanSuggestions(Array.from({ length: 6 }, (_, i) => ({ title: `Task ${i}`, description: '' }))), /up to five/);
});

test('habit check-in dates follow the selected account time zone', () => {
  assert.equal(habitDateInTimezone(new Date('2027-01-01T23:30:00.000Z'), 'Europe/Athens'), '2027-01-02');
  assert.equal(habitDateInTimezone(new Date('2027-01-01T23:30:00.000Z'), 'America/Los_Angeles'), '2027-01-01');
});
