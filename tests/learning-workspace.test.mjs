import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReview, scoreMultipleChoice } from '../src/lib/learning-workspace.mjs';

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
