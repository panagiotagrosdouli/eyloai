import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizAnswers, normalizeQuizQuestions, normalizeQuizTitle, quizPercent, validateQuizAttempt } from '../src/lib/quiz-data.mjs';

const sample = () => Array.from({ length: 3 }, (_, index) => ({ prompt: `Question ${index + 1}`, options: ['A', 'B', 'C', 'D'], correct_index: index, explanation: `Reason ${index + 1}` }));

test('quiz titles and generated questions are normalized and bounded', () => {
  assert.deepEqual(normalizeQuizTitle({ title: ' Methods ', subject: ' Statistics ' }), { title: 'Methods', subject: 'Statistics' });
  assert.equal(normalizeQuizQuestions(sample()).length, 3);
  assert.throws(() => normalizeQuizTitle({ title: ' ' }), /title/);
  assert.throws(() => normalizeQuizTitle({ title: 'x'.repeat(161) }), /160/);
  assert.throws(() => normalizeQuizQuestions(sample().slice(0, 2)), /3–20/);
  assert.throws(() => normalizeQuizQuestions([{ ...sample()[0], correct_index: 5 }, ...sample().slice(1)]), /invalid/);
  assert.throws(() => normalizeQuizQuestions([{ ...sample()[0], options: ['same', 'same', 'C', 'D'] }, ...sample().slice(1)]), /invalid/);
  assert.throws(() => normalizeQuizQuestions([{ ...sample()[0], prompt: 'x'.repeat(2001) }, ...sample().slice(1)]), /invalid/);
  assert.throws(() => normalizeQuizQuestions([sample()[0], { ...sample()[1], prompt: ' question 1 ' }, ...sample().slice(2)]), /duplicate/);
});

test('quiz answers require one valid choice per saved question', () => {
  const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
  assert.deepEqual(buildQuizAnswers(questions, { q1: '0', q2: '2', q3: '3' }), [
    { question_id: 'q1', selected_index: 0 }, { question_id: 'q2', selected_index: 2 }, { question_id: 'q3', selected_index: 3 },
  ]);
  assert.throws(() => buildQuizAnswers(questions, { q1: 0 }), /every quiz question/);
  assert.throws(() => buildQuizAnswers(questions, { q1: 4, q2: 1, q3: 2 }), /every quiz question/);
});

test('server grade is verified against selected answers and saved question IDs', () => {
  const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
  const submitted = [{ question_id: 'q1', selected_index: 0 }, { question_id: 'q2', selected_index: 1 }, { question_id: 'q3', selected_index: 2 }];
  const result = { id: 'attempt', quiz_id: 'quiz-1', correct_count: 2, total_count: 3, completed_at: '2027-01-01T00:00:00Z', answers: [
    { ...submitted[0], is_correct: true }, { ...submitted[1], is_correct: false }, { ...submitted[2], is_correct: true },
  ] };
  assert.equal(validateQuizAttempt([result], questions, submitted, 'quiz-1').correct_count, 2);
  assert.equal(quizPercent(2, 3), 67);
  assert.throws(() => validateQuizAttempt(null, questions, submitted), /incomplete/);
  assert.throws(() => validateQuizAttempt([result], questions, submitted, 'another-quiz'), /incomplete/);
  assert.throws(() => validateQuizAttempt([{ ...result, answers: [{ ...result.answers[0], selected_index: 3 }, ...result.answers.slice(1)] }], questions, submitted), /match/);
  assert.throws(() => validateQuizAttempt([{ ...result, correct_count: 3 }], questions, submitted), /score/);
});
