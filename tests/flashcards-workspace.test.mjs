import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dueFlashcards, gradeFlashcard, normalizeFlashcard, normalizeFlashcardDeck } from '../src/lib/flashcards-domain.mjs';

const migration = readFileSync(new URL('../supabase/migrations/20261112165449_eylo_study_flashcards.sql', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/Flashcards.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');

const card = (overrides = {}) => ({
  id: 'ab5a3c5e-8304-4f63-aabc-b9f9651ad86e',
  front: 'What is working memory?',
  back: 'A limited-capacity system for temporarily holding and manipulating information.',
  due_date: '2026-11-12', last_reviewed_date: null, interval: 0, repetitions: 0, ease_factor: 2.5,
  ...overrides,
});

test('flashcard and deck normalization enforce bounded valid content and unique IDs', () => {
  assert.equal(normalizeFlashcardDeck({ title: '  Memory  ', course: 'Psychology', cards: [card()] }).title, 'Memory');
  assert.throws(() => normalizeFlashcardDeck({ title: '', cards: [] }), error => error.code === 'FLASHCARD_VALIDATION');
  assert.throws(() => normalizeFlashcard(card({ front: '' })), error => error.code === 'FLASHCARD_VALIDATION');
  assert.throws(() => normalizeFlashcard(card({ back: 'x'.repeat(5001) })), error => error.code === 'FLASHCARD_VALIDATION');
  assert.throws(() => normalizeFlashcardDeck({ title: 'Duplicate cards', cards: [card(), card({ id: 'AB5A3C5E-8304-4F63-AABC-B9F9651AD86E' })] }), error => error.code === 'FLASHCARD_VALIDATION');
});

test('due queues include unscheduled cards and dates through today', () => {
  const due = dueFlashcards({ cards: [
    card({ id: 'older', due_date: '2026-11-10' }),
    card({ id: 'future', due_date: '2026-11-13' }),
    card({ id: 'new', due_date: null }),
    card({ id: 'today', due_date: '2026-11-12' }),
  ] }, '2026-11-12');
  assert.deepEqual(due.map(value => value.id), ['new', 'older', 'today']);
});

test('spaced repetition schedules intervals, adjusts ease and retries missed recall', () => {
  const firstGood = gradeFlashcard(card(), 4, '2026-11-12');
  assert.equal(firstGood.interval, 1);
  assert.equal(firstGood.repetitions, 1);
  assert.equal(firstGood.due_date, '2026-11-13');
  const secondGood = gradeFlashcard(firstGood, 4, '2026-11-13');
  assert.equal(secondGood.interval, 6);
  assert.equal(secondGood.repetitions, 2);
  const forgotten = gradeFlashcard(secondGood, 1, '2026-11-14');
  assert.equal(forgotten.interval, 1);
  assert.equal(forgotten.repetitions, 0);
  assert.equal(forgotten.due_date, '2026-11-15');
  assert.throws(() => gradeFlashcard(card(), 6, '2026-11-12'), error => error.code === 'FLASHCARD_VALIDATION');
});

test('flashcard decks enforce owner RLS, owned project links and bounded nested cards', () => {
  assert.match(migration, /alter table public\.study_flashcard_decks enable row level security/i);
  assert.match(migration, /\(select auth\.uid\(\)\) is distinct from new\.user_id/i);
  assert.match(migration, /jsonb_array_length\(new\.data -> 'cards'\) > 500/i);
  assert.match(migration, /p\.id = project_text::uuid and p\.user_id = new\.user_id/i);
  assert.match(migration, /grant select, insert, update, delete on public\.study_flashcard_decks to authenticated/i);
  assert.match(repository, /FlashcardDeck: \{ table: 'study_flashcard_decks' \}/);
});

test('Flashcards UI persists decks and answers through conflict-safe authorized writes', () => {
  assert.match(page, /base44\.entities\.FlashcardDeck\.create/);
  assert.match(page, /base44\.entities\.FlashcardDeck\.updateIfUnchanged/);
  assert.match(page, /base44\.entities\.FlashcardDeck\.delete/);
  assert.match(page, /gradeFlashcard/);
  assert.match(page, /Show answer/);
  assert.match(page, /Review due cards/);
  assert.match(page, /ownerRef\.current = user\?\.id \|\| null/);
  assert.match(app, /path="\/flashcards" element=\{<Flashcards \/>\}/);
  assert.match(layout, /path: '\/flashcards'/);
});
