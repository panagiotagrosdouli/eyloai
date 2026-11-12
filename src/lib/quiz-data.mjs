const cleanText = value => String(value ?? '').trim();

export function normalizeQuizQuestions(value, { min = 3, max = 20 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`A quiz needs ${min}–${max} questions.`);
  const seen = new Set();
  return value.map((item, index) => {
    const prompt = cleanText(item?.prompt);
    const options = Array.isArray(item?.options) ? item.options.map(cleanText) : [];
    const correctIndex = Number(item?.correct_index);
    const explanation = cleanText(item?.explanation);
    const key = prompt.toLocaleLowerCase();
    if (!prompt || prompt.length > 2000 || options.length !== 4 || options.some(option => !option || option.length > 500)
      || new Set(options.map(option => option.toLocaleLowerCase())).size !== 4 || explanation.length > 2000 || !explanation
      || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3 || seen.has(key)) {
      throw new Error(`Question ${index + 1} has invalid or duplicate content.`);
    }
    seen.add(key);
    return { prompt, options, correct_index: correctIndex, explanation };
  });
}

export function normalizeQuizTitle(input = {}) {
  const title = cleanText(input.title);
  const subject = cleanText(input.subject);
  if (!title || title.length > 160) throw new Error('Quiz title must contain 1–160 characters.');
  if (subject.length > 160) throw new Error('Quiz subject must be 160 characters or fewer.');
  return { title, subject };
}

export function buildQuizAnswers(questions, selected = {}) {
  const answerIds = new Set();
  return (questions || []).map(question => {
    const index = Number(selected[question.id]);
    if (!question.id || answerIds.has(question.id) || !Number.isInteger(index) || index < 0 || index > 3) {
      throw new Error('Choose one answer for every quiz question.');
    }
    answerIds.add(question.id);
    return { question_id: question.id, selected_index: index };
  });
}

export function validateQuizAttempt(result, questions, submittedAnswers, quizId = null) {
  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.id || !Array.isArray(questions) || !questions.length || row.total_count !== questions.length
    || (quizId && row.quiz_id !== quizId)
    || !Number.isInteger(row.correct_count) || row.correct_count < 0 || row.correct_count > row.total_count
    || !Number.isFinite(Date.parse(row.completed_at)) || !Array.isArray(row.answers) || row.answers.length !== questions.length) {
    throw new Error('The saved quiz result was incomplete. Reload the quiz before continuing.');
  }
  const submitted = new Map(submittedAnswers.map(answer => [answer.question_id, answer.selected_index]));
  const ids = new Set();
  for (const answer of row.answers) {
    if (!answer?.question_id || ids.has(answer.question_id) || !submitted.has(answer.question_id)
      || answer.selected_index !== submitted.get(answer.question_id) || typeof answer.is_correct !== 'boolean') {
      throw new Error('The saved quiz result did not match your submitted answers.');
    }
    ids.add(answer.question_id);
  }
  if (ids.size !== questions.length || questions.some(question => !ids.has(question.id))) throw new Error('The saved quiz result did not include every question.');
  if (row.correct_count !== row.answers.filter(answer => answer.is_correct).length) throw new Error('The saved quiz score did not match its answers.');
  return row;
}

export function quizPercent(correct, total) {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || correct < 0 || correct > total) return 0;
  return Math.round(correct * 100 / total);
}
