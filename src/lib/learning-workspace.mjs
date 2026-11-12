export const LEARNING_KINDS = Object.freeze([
  'note', 'goal', 'habit', 'life_task', 'subject', 'study_session',
  'deck', 'flashcard', 'quiz', 'quiz_attempt',
]);

export function nextReview(card, quality, reviewedAt = new Date()) {
  const grade = Math.max(0, Math.min(5, Number(quality)));
  const previous = Number(card.interval_days || 0);
  const repetitions = Number(card.repetitions || 0);
  const ease = Math.max(1.3, Number(card.ease_factor || 2.5) + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  const nextRepetitions = grade < 3 ? 0 : repetitions + 1;
  const interval = grade < 3 ? 1 : nextRepetitions === 1 ? 1 : nextRepetitions === 2 ? 6 : Math.max(1, Math.round(previous * ease));
  const due = new Date(reviewedAt);
  due.setDate(due.getDate() + interval);
  return {
    ease_factor: Math.round(ease * 100) / 100,
    interval_days: interval,
    repetitions: nextRepetitions,
    due_at: due.toISOString(),
    last_reviewed_at: reviewedAt.toISOString(),
  };
}

export function scoreMultipleChoice(questions, answers) {
  const results = questions.map((question, index) => ({
    correct: Number(answers[index]) === Number(question.answer),
    selected: answers[index] === undefined ? null : Number(answers[index]),
    answer: Number(question.answer),
    explanation: question.explanation || '',
    prompt: question.prompt,
  }));
  const correct = results.filter((result) => result.correct).length;
  return { correct, total: questions.length, percent: questions.length ? Math.round((correct / questions.length) * 100) : 0, results };
}
