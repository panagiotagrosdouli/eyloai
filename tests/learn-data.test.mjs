import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLearningCourse, normalizeLearningLessons, summarizeLearningProgress, validateSavedCourse } from '../src/lib/learn-data.mjs';

test('course metadata is trimmed and bounded', () => {
  assert.deepEqual(normalizeLearningCourse({ title: ' Methods ', subject: ' Study design ', description: ' A course ' }), { title: 'Methods', subject: 'Study design', description: 'A course' });
  assert.throws(() => normalizeLearningCourse({ title: ' ' }), /Course title/);
  assert.throws(() => normalizeLearningCourse({ title: 'A'.repeat(161) }), /160/);
});

test('lessons validate generated content, count, duplicate titles and quiz links', () => {
  const lessons = [
    { title: 'Design', objective: 'Understand design choices.', content: 'x'.repeat(30), quiz_id: '11111111-1111-4111-8111-111111111111' },
    { title: 'Analysis', objective: 'Interpret results.', content: 'y'.repeat(60) },
  ];
  assert.deepEqual(normalizeLearningLessons(lessons).map(item => item.quiz_id), ['11111111-1111-4111-8111-111111111111', null]);
  assert.throws(() => normalizeLearningLessons(lessons.slice(0, 0)), /1–20/);
  assert.throws(() => normalizeLearningLessons([{ ...lessons[0], content: 'short' }]), /invalid/);
  assert.throws(() => normalizeLearningLessons([lessons[0], { ...lessons[1], title: ' design ' }]), /duplicate/);
  assert.throws(() => normalizeLearningLessons([{ ...lessons[0], quiz_id: 'not-a-uuid' }]), /invalid/);
});

test('course completion is derived from persisted lesson progress', () => {
  assert.deepEqual(summarizeLearningProgress([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [
    { lesson_id: 'a', status: 'completed' }, { lesson_id: 'b', status: 'in_progress' }, { lesson_id: 'foreign', status: 'completed' },
  ]), { completed: 1, total: 3, percent: 33 });
  assert.deepEqual(summarizeLearningProgress([], []), { completed: 0, total: 0, percent: 0 });
});

test('course save is accepted only when every requested lesson is confirmed', () => {
  const result = { id: 'course', title: 'Basics', lesson_count: 3, created_at: '2027-01-01T00:00:00Z' };
  assert.equal(validateSavedCourse([result], 3).id, 'course');
  assert.throws(() => validateSavedCourse({ ...result, lesson_count: 2 }, 3), /every lesson/);
});
