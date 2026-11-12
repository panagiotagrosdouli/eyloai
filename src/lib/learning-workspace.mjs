export const LEARNING_KINDS = Object.freeze([
  'note', 'goal', 'habit', 'life_task', 'subject', 'study_goal', 'study_session',
  'deck', 'flashcard', 'quiz', 'quiz_attempt', 'notebook',
]);

const RICH_TEXT_TAGS = new Set(['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a']);

export function noteTextContent(value = '') {
  if (typeof DOMParser === 'undefined') return String(value).replace(/<[^>]*>/g, ' ');
  const parsed = new DOMParser().parseFromString(String(value), 'text/html');
  const chunks = [];
  const visit = (node) => {
    if (node.nodeType === 3) { chunks.push(node.nodeValue || ''); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName === 'BR') { chunks.push('\n'); return; }
    for (const child of Array.from(node.childNodes)) visit(child);
    if (['P', 'DIV', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'PRE'].includes(node.tagName)) chunks.push('\n');
  };
  for (const child of Array.from(parsed.body.childNodes)) visit(child);
  return chunks.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function noteHtmlFromText(value = '') {
  const source = String(value);
  if (/<\/?(?:p|div|span|br|strong|b|em|i|u|s|h2|h3|ul|ol|li|blockquote|pre|code|a)(?:\s|>)/i.test(source)) {
    return sanitizeNoteHtml(source);
  }
  return source.split('\n').map((line) => line ? `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : '<p><br></p>').join('');
}

export function sanitizeNoteHtml(value = '') {
  if (typeof DOMParser === 'undefined') return String(value).replace(/<[^>]*>/g, '');
  const parsed = new DOMParser().parseFromString(String(value), 'text/html');
  const render = (node) => {
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(render).join('');
    if (!RICH_TEXT_TAGS.has(tag)) return children;
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      try {
        const url = new URL(href, document.baseURI);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return children;
        return `<a href="${url.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" rel="noopener noreferrer">${children}</a>`;
      } catch { return children; }
    }
    return tag === 'br' ? '<br>' : `<${tag}>${children}</${tag}>`;
  };
  return Array.from(parsed.body.childNodes).map(render).join('');
}

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

export function examRevisionDates(examDate, today = new Date(), offsets = [7, 3, 1]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(examDate || ''))) return [];
  const exam = new Date(`${examDate}T12:00:00`);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const normalizedExamDate = Number.isNaN(exam.getTime()) ? '' : `${exam.getFullYear()}-${String(exam.getMonth() + 1).padStart(2, '0')}-${String(exam.getDate()).padStart(2, '0')}`;
  if (normalizedExamDate !== examDate) return [];
  return offsets.map((offset) => {
    const session = new Date(exam);
    session.setDate(session.getDate() - offset);
    return session;
  }).filter((session) => session >= start && session < exam)
    .map((session) => `${session.getFullYear()}-${String(session.getMonth() + 1).padStart(2, '0')}-${String(session.getDate()).padStart(2, '0')}`);
}

export function addHabitCheckin(checkins = [], date = new Date()) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return checkins.includes(key) ? [...checkins] : [...checkins, key].sort();
}

export function nextRecurringTaskDate(dueDate, cadence) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || '')) || !['daily', 'weekly'].includes(cadence)) return null;
  const next = new Date(`${dueDate}T12:00:00.000Z`);
  if (Number.isNaN(next.getTime()) || next.toISOString().slice(0, 10) !== dueDate) return null;
  next.setUTCDate(next.getUTCDate() + (cadence === 'weekly' ? 7 : 1));
  return next.toISOString().slice(0, 10);
}
