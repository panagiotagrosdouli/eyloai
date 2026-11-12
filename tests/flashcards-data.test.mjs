import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDeckInput, normalizeFlashcardInput, selectDueFlashcards, validateReviewResult } from '../src/lib/flashcards-data.mjs';

test('deck and card inputs normalize text and source-note links', () => {
  assert.deepEqual(normalizeDeckInput({ title: '  Methods  ', description: '  Week one ' }), { title: 'Methods', description: 'Week one' });
  assert.deepEqual(normalizeFlashcardInput({ question: ' Q? ', answer: ' A. ', note_id: 'note-1' }), { question: 'Q?', answer: 'A.', note_id: 'note-1' });
  assert.throws(() => normalizeDeckInput({ title: ' ' }), /Deck title/);
  assert.throws(() => normalizeFlashcardInput({ question: '', answer: 'A' }), /Question/);
  assert.throws(() => normalizeFlashcardInput({ question: 'Q', answer: ' ' }), /Answer/);
});

test('due selection is deterministic, bounded by selected deck, and excludes future or invalid rows', () => {
  const cards = [
    { id: 'future', deck_id: 'a', due_at: '2027-01-03T00:00:00Z' },
    { id: 'due-later', deck_id: 'a', due_at: '2027-01-01T01:00:00Z', created_at: '2026-12-01T00:00:00Z' },
    { id: 'due-first', deck_id: 'a', due_at: '2027-01-01T00:00:00Z', created_at: '2026-12-02T00:00:00Z' },
    { id: 'other', deck_id: 'b', due_at: '2027-01-01T00:00:00Z' },
    { id: 'invalid', deck_id: 'a', due_at: 'bad' },
  ];
  assert.deepEqual(selectDueFlashcards(cards, { now: Date.parse('2027-01-02T00:00:00Z'), deckId: 'a' }).map(card => card.id), ['due-first', 'due-later']);
});

test('review result validation rejects fabricated or malformed persistence results', () => {
  const card = { id: 'card-1' };
  const saved = { id: 'card-1', due_at: '2027-01-02T00:00:00Z', interval_days: 1, repetitions: 1, ease_factor: '2.60', revision: 2 };
  assert.equal(validateReviewResult([saved], card, 4).ease_factor, 2.6);
  assert.throws(() => validateReviewResult(null, card, 4), /incomplete/);
  assert.throws(() => validateReviewResult({ ...saved, id: 'foreign-card' }, card, 4), /incomplete/);
});
