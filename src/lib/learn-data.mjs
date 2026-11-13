const textValue = value => String(value ?? '').trim();

export function normalizeLearningCourse(input = {}) {
  const title = textValue(input.title);
  const subject = textValue(input.subject);
  const description = textValue(input.description);
  if (!title || title.length > 160) throw new Error('Course title must contain 1–160 characters.');
  if (subject.length > 160) throw new Error('Course subject must be 160 characters or fewer.');
  if (description.length > 2000) throw new Error('Course description must be 2,000 characters or fewer.');
  return { title, subject, description };
}

export function normalizeLearningLessons(value, { min = 1, max = 20 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`A course needs ${min}–${max} lessons.`);
  const titles = new Set();
  return value.map((item, index) => {
    const title = textValue(item?.title);
    const objective = textValue(item?.objective);
    const content = textValue(item?.content);
    const quizId = textValue(item?.quiz_id) || null;
    if (!title || title.length > 160 || !objective || objective.length > 500 || content.length < 30 || content.length > 8000
      || (quizId && !/^[0-9a-f-]{36}$/i.test(quizId)) || titles.has(title.toLocaleLowerCase())) {
      throw new Error(`Lesson ${index + 1} has invalid or duplicate content.`);
    }
    titles.add(title.toLocaleLowerCase());
    return { title, objective, content, quiz_id: quizId };
  });
}

export function summarizeLearningProgress(lessons, progress) {
  const rows = lessons || [];
  const byLesson = new Map((progress || []).map(item => [item.lesson_id, item]));
  const completed = rows.filter(lesson => byLesson.get(lesson.id)?.status === 'completed').length;
  return { completed, total: rows.length, percent: rows.length ? Math.round(completed * 100 / rows.length) : 0 };
}

export function validateSavedCourse(result, expectedLessons) {
  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.id || row.lesson_count !== expectedLessons || !Number.isFinite(Date.parse(row.created_at))) {
    throw new Error('The saved course did not confirm every lesson. Reload and verify before retrying.');
  }
  return row;
}
