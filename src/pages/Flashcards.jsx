import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Save, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { dueFlashcards, gradeFlashcard, normalizeFlashcardDeck } from '@/lib/flashcards-domain.mjs';

const EMPTY_DECK = { title: '', description: '', course: '', project_id: '', cards: [] };
const copyDeck = deck => ({ ...EMPTY_DECK, ...(deck || {}), project_id: deck?.project_id || '', cards: Array.isArray(deck?.cards) ? deck.cards.map(card => ({ ...card })) : [] });
const sameDeck = (left, right) => JSON.stringify(copyDeck(left)) === JSON.stringify(copyDeck(right));

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Flashcards() {
  const { user } = useAuth();
  const ownerRef = useRef(user?.id || null);
  const [decks, setDecks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(EMPTY_DECK);
  const [baseline, setBaseline] = useState(EMPTY_DECK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const dirty = !sameDeck(editor, baseline);

  const load = async (ownerId = ownerRef.current) => {
    if (!ownerId || ownerId !== ownerRef.current) return;
    setLoading(true);
    setError('');
    const [deckResult, projectResult] = await Promise.allSettled([
      base44.entities.FlashcardDeck.list('-updated_date', 1000),
      base44.entities.Project.list('-updated_date', 1000),
    ]);
    if (ownerId !== ownerRef.current) return;
    if (deckResult.status === 'fulfilled') setDecks(deckResult.value);
    else setError('Flashcard decks could not be loaded. Check your connection and retry.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    else setNotice('Projects could not be loaded. Decks remain available without project links.');
    setLoading(false);
  };

  useEffect(() => {
    ownerRef.current = user?.id || null;
    setDecks([]);
    setProjects([]);
    setSelected(null);
    setEditor(EMPTY_DECK);
    setBaseline(EMPTY_DECK);
    setReviewQueue([]);
    setReviewTotal(0);
    setRevealed(false);
    setError('');
    setNotice('');
    if (user?.id) void load(user.id);
    else setLoading(false);
  }, [user?.id]);

  const projectNames = useMemo(() => new Map(projects.map(project => [project.id, project.title || 'Untitled project'])), [projects]);
  const totalCards = decks.reduce((sum, deck) => sum + (Array.isArray(deck.cards) ? deck.cards.length : 0), 0);
  const dueCount = decks.reduce((sum, deck) => sum + dueFlashcards(deck, todayLocal()).length, 0);
  const currentReviewCard = selected?.cards?.find(card => card.id === reviewQueue[0]) || null;

  const createDeck = () => {
    if (dirty && !window.confirm('Discard unsaved deck changes?')) return;
    setSelected(null);
    setEditor(EMPTY_DECK);
    setBaseline(EMPTY_DECK);
    setReviewQueue([]);
    setReviewTotal(0);
    setRevealed(false);
    setError('');
    setNotice('New deck. Save it before adding cards.');
  };

  const chooseDeck = deck => {
    if (dirty && !window.confirm('Discard unsaved deck changes?')) return;
    const next = copyDeck(deck);
    setSelected(deck);
    setEditor(next);
    setBaseline(next);
    setReviewQueue([]);
    setReviewTotal(0);
    setRevealed(false);
    setError('');
    setNotice('');
  };

  const saveDeck = async event => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = normalizeFlashcardDeck(editor);
      const project = projects.find(item => item.id === payload.project_id);
      const savePayload = { ...payload, project_title: project?.title || (payload.project_id === selected?.project_id ? selected?.project_title : '') || '' };
      const saved = selected
        ? await base44.entities.FlashcardDeck.updateIfUnchanged(selected.id, savePayload, selected.updated_date)
        : await base44.entities.FlashcardDeck.create(savePayload);
      if (ownerId !== ownerRef.current) return;
      setSelected(saved);
      setEditor(copyDeck(saved));
      setBaseline(copyDeck(saved));
      setDecks(current => [saved, ...current.filter(deck => deck.id !== saved.id)]);
      setNotice('Deck saved.');
    } catch (saveError) {
      if (ownerId !== ownerRef.current) return;
      setError(saveError?.code === 'ENTITY_CONFLICT'
        ? 'This deck changed in another tab. Reload the latest version before saving.'
        : saveError?.message || 'The deck could not be saved. Your edits are still here.');
    } finally {
      setSaving(false);
    }
  };

  const addCard = () => {
    if (!selected) {
      setError('Save the deck before adding cards.');
      return;
    }
    if (editor.cards.length >= 500) {
      setError('A deck can have at most 500 cards.');
      return;
    }
    setEditor(current => ({
      ...current,
      cards: [...current.cards, {
        id: crypto.randomUUID(), front: '', back: '', due_date: todayLocal(),
        last_reviewed_date: null, interval: 0, repetitions: 0, ease_factor: 2.5,
      }],
    }));
    setError('');
  };

  const updateCardText = (cardId, field, value) => setEditor(current => ({
    ...current,
    cards: current.cards.map(card => card.id === cardId ? { ...card, [field]: value } : card),
  }));

  const removeCard = cardId => setEditor(current => ({ ...current, cards: current.cards.filter(card => card.id !== cardId) }));

  const deleteDeck = async () => {
    if (!selected || !window.confirm(`Delete the “${selected.title}” deck and all ${selected.cards?.length || 0} cards?`)) return;
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    try {
      await base44.entities.FlashcardDeck.delete(selected.id);
      if (ownerId !== ownerRef.current) return;
      setDecks(current => current.filter(deck => deck.id !== selected.id));
      setSelected(null);
      setEditor(EMPTY_DECK);
      setBaseline(EMPTY_DECK);
      setReviewQueue([]);
      setNotice('Deck deleted.');
    } catch (deleteError) {
      if (ownerId === ownerRef.current) setError(deleteError?.message || 'The deck could not be deleted. Retry in a moment.');
    }
  };

  const startReview = () => {
    if (!selected) return;
    if (dirty && !window.confirm('Discard unsaved deck changes before starting a review?')) return;
    if (dirty) {
      setEditor(copyDeck(selected));
      setBaseline(copyDeck(selected));
    }
    const due = dueFlashcards(selected, todayLocal()).map(card => card.id);
    setReviewQueue(due);
    setReviewTotal(due.length);
    setRevealed(false);
    setNotice(due.length ? `${due.length} due card${due.length === 1 ? '' : 's'} in this session.` : 'No cards are due today.');
  };

  const gradeCurrent = async grade => {
    const ownerId = ownerRef.current;
    if (!ownerId || !selected || !currentReviewCard || !revealed || reviewSaving) return;
    setReviewSaving(true);
    setError('');
    try {
      const reviewedCard = gradeFlashcard(currentReviewCard, grade, todayLocal());
      const cards = selected.cards.map(card => card.id === reviewedCard.id ? reviewedCard : card);
      const saved = await base44.entities.FlashcardDeck.updateIfUnchanged(selected.id, { cards }, selected.updated_date);
      if (ownerId !== ownerRef.current) return;
      setSelected(saved);
      setEditor(copyDeck(saved));
      setBaseline(copyDeck(saved));
      setDecks(current => current.map(deck => deck.id === saved.id ? saved : deck));
      setReviewQueue(current => current.slice(1));
      setRevealed(false);
      setNotice(`Saved review. ${Math.max(0, reviewQueue.length - 1)} card${reviewQueue.length - 1 === 1 ? '' : 's'} remain in this session.`);
    } catch (reviewError) {
      if (ownerId === ownerRef.current) setError(reviewError?.code === 'ENTITY_CONFLICT'
        ? 'This deck changed elsewhere. Reload it before saving this review.'
        : reviewError?.message || 'The review could not be saved. The card remains due.');
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <div className="eylo-page max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="eylo-eyebrow">Learning workspace</p><h1 className="eylo-page-heading">Flashcards</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Build real card decks and review them with spaced repetition. Your grades set the next review date.</p></div><div className="flex gap-2"><Link to="/study-planner" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Study Planner</Link><button type="button" onClick={createDeck} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus size={16} /> New deck</button></div></header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Flashcard summary"><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Decks</p><p className="mt-2 text-2xl font-semibold tabular-nums">{decks.length}</p></div><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Cards</p><p className="mt-2 text-2xl font-semibold tabular-nums">{totalCards}</p></div><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Due now</p><p className="mt-2 text-2xl font-semibold tabular-nums">{dueCount}</p></div></div>
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Reload</button></div>}
      {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-3" aria-label="Flashcard decks"><div className="flex items-center justify-between px-2 pb-3"><h2 className="text-sm font-semibold">Your decks</h2><span className="text-xs text-muted-foreground">{decks.length}</span></div>{loading ? <p role="status" className="px-2 py-5 text-sm text-muted-foreground">Loading decks…</p> : decks.length ? <ul className="space-y-1">{decks.map(deck => <li key={deck.id}><button type="button" onClick={() => chooseDeck(deck)} aria-current={selected?.id === deck.id ? 'page' : undefined} className={`w-full rounded-lg px-3 py-2.5 text-left ${selected?.id === deck.id ? 'bg-secondary' : 'hover:bg-secondary/60'}`}><span className="block truncate text-sm font-medium">{deck.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{deck.cards?.length || 0} cards · {dueFlashcards(deck, todayLocal()).length} due</span>{deck.course && <span className="mt-1 block truncate text-[10px] text-muted-foreground">{deck.course}</span>}</button></li>)}</ul> : <p className="px-2 py-5 text-sm text-muted-foreground">Create your first deck to begin.</p>}</aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Deck editor"><form onSubmit={saveDeck}><fieldset disabled={reviewQueue.length > 0} className="min-w-0"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{selected ? 'Edit deck' : 'New deck'}</h2><div className="flex gap-2">{selected && <button type="button" onClick={() => void deleteDeck()} aria-label="Delete deck" className="grid min-h-9 w-9 place-items-center rounded-lg border border-destructive/30 text-destructive"><Trash2 size={15} /></button>}{selected && <button type="button" onClick={startReview} disabled={!dueFlashcards(selected, todayLocal()).length} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"><BookOpen size={14} /> Review due cards</button>}<button type="submit" disabled={saving || (!dirty && Boolean(selected))} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save deck'}</button></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Deck title<input required maxLength={120} value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} placeholder="Cell biology" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="text-xs font-medium text-muted-foreground">Course<input maxLength={160} value={editor.course} onChange={event => setEditor(current => ({ ...current, course: event.target.value }))} placeholder="Optional course name" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="text-xs font-medium text-muted-foreground sm:col-span-2">Description<textarea maxLength={2000} rows={2} value={editor.description} onChange={event => setEditor(current => ({ ...current, description: event.target.value }))} placeholder="What this deck covers" className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm" /></label><label className="text-xs font-medium text-muted-foreground sm:col-span-2">Project link<select value={editor.project_id} onChange={event => setEditor(current => ({ ...current, project_id: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{projectNames.get(project.id)}</option>)}</select></label></div>
            <div className="mt-5 border-t border-border pt-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold">Cards <span className="font-normal text-muted-foreground">({editor.cards.length}/500)</span></h3><button type="button" onClick={addCard} disabled={!selected || editor.cards.length >= 500} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-50"><Plus size={13} /> Add card</button></div>
              {!selected && <p className="mb-3 text-[11px] text-muted-foreground">Save the deck before adding cards.</p>}
              {editor.cards.length ? <ul className="space-y-3">{editor.cards.map((card, index) => <li key={card.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"><label className="text-[11px] font-medium text-muted-foreground">Front {index + 1}<textarea required maxLength={2000} rows={3} value={card.front} onChange={event => updateCardText(card.id, 'front', event.target.value)} placeholder="Question or prompt" className="mt-1.5 w-full rounded-lg border border-border bg-background p-2.5 text-sm" /></label><label className="text-[11px] font-medium text-muted-foreground">Back {index + 1}<textarea required maxLength={5000} rows={3} value={card.back} onChange={event => updateCardText(card.id, 'back', event.target.value)} placeholder="Answer or explanation" className="mt-1.5 w-full rounded-lg border border-border bg-background p-2.5 text-sm" /></label><div className="flex items-center justify-between text-[10px] text-muted-foreground sm:col-span-2"><span>{card.repetitions ? `Reviewed ${card.repetitions} times · Due ${card.due_date || 'not scheduled'}` : 'New card · Due now'}</span><button type="button" onClick={() => removeCard(card.id)} className="rounded px-2 py-1 text-destructive hover:bg-destructive/5">Remove</button></div></li>)}</ul> : <p className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-xs text-muted-foreground">No cards in this deck yet.</p>}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">Project: {editor.project_id ? projectNames.get(editor.project_id) || selected?.project_title || 'Linked project' : 'None'} · Review progress is stored with each card.</p>
          </fieldset></form></section>

          {reviewQueue.length > 0 && currentReviewCard && <section className="rounded-xl border border-primary/20 bg-card p-5 sm:p-7" aria-label="Flashcard review session"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="eylo-eyebrow">Review session</p><h2 className="text-sm font-semibold">Card {reviewTotal - reviewQueue.length + 1} of {reviewTotal}</h2></div><span className="text-xs text-muted-foreground">{reviewQueue.length} left</span></div><div className="grid min-h-40 place-items-center rounded-xl border border-border bg-background p-5 text-center"><p className="max-w-2xl whitespace-pre-wrap text-lg font-medium">{revealed ? currentReviewCard.back : currentReviewCard.front}</p></div>{!revealed ? <button type="button" onClick={() => setRevealed(true)} className="mt-4 min-h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Show answer</button> : <div className="mt-4"><p className="mb-2 text-center text-xs text-muted-foreground">How well did you recall it?</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[0, 'Again'], [3, 'Hard'], [4, 'Good'], [5, 'Easy']].map(([grade, label]) => <button type="button" key={grade} onClick={() => void gradeCurrent(grade)} disabled={reviewSaving} className="min-h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary disabled:opacity-50">{label}</button>)}</div></div>}</section>}
          {reviewQueue.length === 0 && selected && <div role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">{dueFlashcards(selected, todayLocal()).length ? 'Start a review session when you are ready.' : 'No cards are due today.'}</div>}
        </div>
      </div>
    </div>
  );
}
