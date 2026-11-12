const LIMITS = Object.freeze({ title: 120, description: 2000, cards: 500, front: 2000, back: 5000 });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message) {
  return Object.assign(new Error(message), { code: 'FLASHCARD_VALIDATION' });
}

function bounded(value, limit, label, required = false) {
  const result = String(value ?? '').trim();
  if (required && !result) throw invalid(`${label} is required.`);
  if (result.length > limit) throw invalid(`${label} must be ${limit} characters or fewer.`);
  return result;
}

export function normalizeFlashcard(input = {}) {
  const id = bounded(input.id, 64, 'Card ID', true);
  if (!UUID_PATTERN.test(id)) throw invalid('Card ID is invalid.');
  const front = bounded(input.front, LIMITS.front, 'Front', true);
  const back = bounded(input.back, LIMITS.back, 'Back', true);
  const interval = Number(input.interval ?? 0);
  const repetitions = Number(input.repetitions ?? 0);
  const easeFactor = Number(input.ease_factor ?? 2.5);
  if (!Number.isInteger(interval) || interval < 0 || interval > 36500) throw invalid('Review interval is invalid.');
  if (!Number.isInteger(repetitions) || repetitions < 0 || repetitions > 100000) throw invalid('Review count is invalid.');
  if (!Number.isFinite(easeFactor) || easeFactor < 1.3 || easeFactor > 3.0) throw invalid('Ease factor is invalid.');
  return {
    id,
    front,
    back,
    due_date: validateOptionalDate(input.due_date, 'Due date'),
    last_reviewed_date: validateOptionalDate(input.last_reviewed_date, 'Review date'),
    interval,
    repetitions,
    ease_factor: easeFactor,
  };
}

function validateOptionalDate(value, label) {
  const date = bounded(value, 10, label);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) {
    throw invalid(`${label} must be a valid calendar date.`);
  }
  return date || null;
}

export function normalizeFlashcardDeck(input = {}) {
  const title = bounded(input.title, LIMITS.title, 'Deck title', true);
  const description = bounded(input.description, LIMITS.description, 'Deck description');
  const course = bounded(input.course, 160, 'Course');
  const projectId = bounded(input.project_id, 64, 'Project ID');
  if (projectId && !UUID_PATTERN.test(projectId)) throw invalid('Project ID is invalid.');
  const cards = Array.isArray(input.cards) ? input.cards : [];
  if (cards.length > LIMITS.cards) throw invalid(`A deck can have at most ${LIMITS.cards} cards.`);
  const normalizedCards = cards.map(normalizeFlashcard);
  if (new Set(normalizedCards.map(card => card.id.toLowerCase())).size !== normalizedCards.length) {
    throw invalid('Card IDs must be unique within a deck.');
  }
  return {
    title,
    description,
    course,
    project_id: projectId || null,
    cards: normalizedCards,
  };
}

export function dueFlashcards(deck, today = new Date().toISOString().slice(0, 10)) {
  return (Array.isArray(deck?.cards) ? deck.cards : [])
    .filter(card => !card.due_date || card.due_date <= today)
    .sort((left, right) => String(left.due_date || '').localeCompare(String(right.due_date || '')));
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function gradeFlashcard(cardInput, grade, today = new Date().toISOString().slice(0, 10)) {
  const quality = Number(grade);
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw invalid('Review grade must be an integer from 0 to 5.');
  const card = normalizeFlashcard(cardInput);
  validateOptionalDate(today, 'Review date');
  let interval = card.interval;
  let repetitions = card.repetitions;
  let easeFactor = card.ease_factor;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * easeFactor));
  }

  const qualityGap = 5 - quality;
  easeFactor = Math.max(1.3, Math.min(3.0, easeFactor + 0.1 - qualityGap * (0.08 + qualityGap * 0.02)));
  return {
    ...card,
    interval,
    repetitions,
    ease_factor: Number(easeFactor.toFixed(2)),
    last_reviewed_date: today,
    due_date: addDays(today, interval),
  };
}
