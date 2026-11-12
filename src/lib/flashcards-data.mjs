export function normalizeDeckInput(input = {}) {
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  if (!title || title.length > 120) throw new Error('Deck title must contain 1–120 characters.');
  if (description.length > 1000) throw new Error('Deck description must be 1,000 characters or fewer.');
  return { title, description };
}

export function normalizeFlashcardInput(input = {}) {
  const question = String(input.question || '').trim();
  const answer = String(input.answer || '').trim();
  if (!question || question.length > 2000) throw new Error('Question must contain 1–2,000 characters.');
  if (!answer || answer.length > 5000) throw new Error('Answer must contain 1–5,000 characters.');
  return { question, answer, note_id: input.note_id || null };
}

export function selectDueFlashcards(cards, { now = Date.now(), deckId = null } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Choose a valid review time.');
  return (cards || []).filter(card => (!deckId || card.deck_id === deckId) && Number.isFinite(Date.parse(card.due_at)) && Date.parse(card.due_at) <= timestamp)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at) || Date.parse(a.created_at) - Date.parse(b.created_at));
}

export function validateReviewResult(result, card, rating) {
  const row = Array.isArray(result) ? result[0] : result;
  if (!row || row.id !== card?.id || !Number.isInteger(row.interval_days) || row.interval_days < 0
    || !Number.isInteger(row.repetitions) || row.repetitions < 0 || !Number.isInteger(row.revision)
    || !Number.isFinite(Number(row.ease_factor)) || !Number.isFinite(Date.parse(row.due_at))
    || !Number.isInteger(rating) || rating < 0 || rating > 5) {
    throw new Error('The saved review result was incomplete. Reload the deck before continuing.');
  }
  return { ...row, ease_factor: Number(row.ease_factor) };
}
