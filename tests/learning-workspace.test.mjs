import test from 'node:test';
import assert from 'node:assert/strict';
import { addHabitCheckin, examRevisionDates, nextRecurringTaskDate, nextReview, scoreMultipleChoice } from '../src/lib/learning-workspace.mjs';

test('spaced repetition schedules a new correct card at one day then six days', () => {
  const reviewedAt = new Date('2026-01-01T12:00:00.000Z');
  const first = nextReview({}, 4, reviewedAt);
  assert.equal(first.interval_days, 1);
  assert.equal(first.repetitions, 1);
  assert.equal(first.due_at, '2026-01-02T12:00:00.000Z');
  const second = nextReview(first, 4, reviewedAt);
  assert.equal(second.interval_days, 6);
  assert.equal(second.repetitions, 2);
});

test('failed recall resets repetitions and schedules a retry', () => {
  const failed = nextReview({ repetitions: 5, interval_days: 30, ease_factor: 2.3 }, 2, new Date('2026-02-10T00:00:00.000Z'));
  assert.equal(failed.repetitions, 0);
  assert.equal(failed.interval_days, 1);
  assert.equal(failed.due_at, '2026-02-11T00:00:00.000Z');
});

test('multiple-choice grading returns the score and explanations for review', () => {
  const result = scoreMultipleChoice([
    { prompt: 'Which?', answer: 1, explanation: 'Because evidence supports B.' },
    { prompt: 'What?', answer: 0 },
  ], [1, 2]);
  assert.equal(result.correct, 1);
  assert.equal(result.percent, 50);
  assert.equal(result.results[0].explanation, 'Because evidence supports B.');
  assert.equal(result.results[1].correct, false);
});

test('revision planning creates 7, 3, and 1 day sessions before an exam', () => {
  assert.deepEqual(examRevisionDates('2026-04-20', new Date('2026-04-10T12:00:00')), ['2026-04-13', '2026-04-17', '2026-04-19']);
  assert.deepEqual(examRevisionDates('2026-04-20', new Date('2026-04-18T12:00:00')), ['2026-04-19']);
  assert.deepEqual(examRevisionDates('not-a-date', new Date('2026-04-10T12:00:00')), []);
  assert.deepEqual(examRevisionDates('2026-02-30', new Date('2026-02-10T12:00:00')), []);
});

test('habit check-ins are dated and idempotent for the same day', () => {
  const checkins = ['2026-04-01'];
  assert.deepEqual(addHabitCheckin(checkins, new Date('2026-04-02T10:00:00')), ['2026-04-01', '2026-04-02']);
  assert.deepEqual(addHabitCheckin(checkins, new Date('2026-04-01T18:00:00')), ['2026-04-01']);
});

test('daily and weekly recurrence respects leap-day and month boundaries', () => {
  assert.equal(nextRecurringTaskDate('2024-02-28', 'daily'), '2024-02-29');
  assert.equal(nextRecurringTaskDate('2024-02-29', 'daily'), '2024-03-01');
  assert.equal(nextRecurringTaskDate('2026-11-08', 'weekly'), '2026-11-15');
  assert.equal(nextRecurringTaskDate('2026-11-08', 'none'), null);
  assert.equal(nextRecurringTaskDate('2026-02-30', 'daily'), null);
});
