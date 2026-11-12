import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { requireSupabase, getUsableSession } from '@/lib/supabaseClient';
import { normalizeDeckInput, normalizeFlashcardInput, selectDueFlashcards, validateReviewResult } from '@/lib/flashcards-data.mjs';
import { BookOpen, LoaderCircle, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';

const emptyDeck = { title: '', description: '' };
const emptyCard = { question: '', answer: '', note_id: '' };
const errorMessage = error => error?.code === '23505' ? 'That item already exists.' : error?.message || 'The flashcard action failed. Please retry.';

export default function Flashcards() {
  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [deckId, setDeckId] = useState('');
  const [deckForm, setDeckForm] = useState(emptyDeck);
  const [cardForm, setCardForm] = useState(emptyCard);
  const [editingDeck, setEditingDeck] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reviewPosition, setReviewPosition] = useState(0);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const client = requireSupabase();
      const [deckResult, cardResult, noteResult, reviewResult] = await Promise.all([
        client.from('flashcard_decks').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }).limit(1000),
        client.from('flashcards').select('*').eq('user_id', session.user.id).order('due_at', { ascending: true }).limit(5000),
        client.from('notes').select('id,title').eq('user_id', session.user.id).order('updated_at', { ascending: false }).limit(1000),
        client.from('flashcard_reviews').select('id,reviewed_at,rating,flashcard_id').eq('user_id', session.user.id).order('reviewed_at', { ascending: false }).limit(1000),
      ]);
      for (const result of [deckResult, cardResult, noteResult, reviewResult]) if (result.error) throw result.error;
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Loading was canceled because your account changed.');
      setDecks(deckResult.data || []); setCards(cardResult.data || []); setNotes(noteResult.data || []); setReviews(reviewResult.data || []);
      setDeckId(currentId => (deckResult.data || []).some(deck => deck.id === currentId) ? currentId : deckResult.data?.[0]?.id || '');
    } catch (loadError) { setError(errorMessage(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedDeck = decks.find(deck => deck.id === deckId) || null;
  const deckCards = useMemo(() => cards.filter(card => card.deck_id === deckId), [cards, deckId]);
  const dueCards = useMemo(() => selectDueFlashcards(deckCards), [deckCards]);
  const activeCard = dueCards[reviewPosition] || null;
  const setSavedDeck = (row, wasEditing) => setDecks(items => wasEditing
    ? items.map(item => item.id === row.id ? row : item)
    : [row, ...items]);

  const saveDeck = async event => {
    event.preventDefault(); if (pending) return;
    setPending(true); setError(''); setStatus('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const payload = normalizeDeckInput(deckForm);
      const query = editingDeck
        ? requireSupabase().from('flashcard_decks').update(payload).eq('id', editingDeck.id).eq('user_id', session.user.id).eq('revision', editingDeck.revision)
        : requireSupabase().from('flashcard_decks').insert({ ...payload, user_id: session.user.id });
      const { data, error: saveError } = await query.select('*').single();
      if (saveError) throw saveError;
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Save canceled because your account changed.');
      setSavedDeck(data, Boolean(editingDeck)); setDeckId(data.id); setDeckForm(emptyDeck); setEditingDeck(null); setStatus('Deck saved.');
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setPending(false); }
  };

  const saveCard = async event => {
    event.preventDefault(); if (pending || !deckId) return;
    setPending(true); setError(''); setStatus('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const payload = normalizeFlashcardInput({ ...cardForm, note_id: cardForm.note_id || null });
      const query = editingCard
        ? requireSupabase().from('flashcards').update(payload).eq('id', editingCard.id).eq('user_id', session.user.id).eq('revision', editingCard.revision)
        : requireSupabase().from('flashcards').insert({ ...payload, deck_id: deckId, user_id: session.user.id });
      const { data, error: saveError } = await query.select('*').maybeSingle();
      if (saveError) throw saveError;
      if (!data) throw new Error('Card changed in another session or access was denied. Reload the deck and retry.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Save canceled because your account changed.');
      setCards(previous => editingCard ? previous.map(item => item.id === data.id ? data : item) : [data, ...previous]);
      setCardForm(emptyCard); setEditingCard(null); setStatus('Flashcard saved.');
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setPending(false); }
  };

  const deleteCard = async card => {
    if (!window.confirm(`Delete this flashcard: “${card.question}”?`)) return;
    setError(''); setStatus('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: deleteError } = await requireSupabase().from('flashcards').delete().eq('id', card.id).eq('user_id', session.user.id).eq('revision', card.revision).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Card changed in another session or access was denied. Reload and retry.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Delete canceled because your account changed.');
      setCards(previous => previous.filter(item => item.id !== card.id));
      setReviews(previous => previous.filter(item => item.flashcard_id !== card.id)); setStatus('Flashcard deleted.');
    } catch (deleteError) { setError(errorMessage(deleteError)); }
  };

  const deleteDeck = async deck => {
    if (!window.confirm(`Delete “${deck.title}” and all its flashcards and review history?`)) return;
    setError(''); setStatus('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: deleteError } = await requireSupabase().from('flashcard_decks').delete().eq('id', deck.id).eq('user_id', session.user.id).eq('revision', deck.revision).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Deck changed in another session or access was denied. Reload and retry.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Delete canceled because your account changed.');
      setDecks(previous => previous.filter(item => item.id !== deck.id)); setCards(previous => previous.filter(item => item.deck_id !== deck.id));
      const removedCardIds = new Set(deckCards.filter(card => card.deck_id === deck.id).map(card => card.id));
      setReviews(previous => previous.filter(review => !removedCardIds.has(review.flashcard_id)));
      if (deckId === deck.id) { setDeckId(''); setReviewing(false); setReviewPosition(0); }
      setStatus('Deck and its reviews deleted.');
    } catch (deleteError) { setError(errorMessage(deleteError)); }
  };

  const rateCard = async rating => {
    if (!activeCard || pending) return;
    setPending(true); setError(''); setStatus('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: reviewError } = await requireSupabase().rpc('review_flashcard', {
        p_flashcard_id: activeCard.id, p_rating: rating, p_expected_revision: activeCard.revision,
      });
      if (reviewError) throw reviewError;
      const saved = validateReviewResult(data, activeCard, rating);
      const { data: reviewRecord, error: recordError } = await requireSupabase().from('flashcard_reviews')
        .select('id,reviewed_at,rating,flashcard_id').eq('user_id', session.user.id)
        .eq('flashcard_id', activeCard.id).eq('reviewed_at', saved.reviewed_at).maybeSingle();
      if (recordError) throw recordError;
      if (!reviewRecord) throw new Error('Review schedule changed but its history record was not found. Reload and verify before continuing.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Review canceled because your account changed.');
      setCards(previous => previous.map(card => card.id === activeCard.id ? { ...card, ...saved } : card));
      setReviews(previous => [reviewRecord, ...previous].slice(0, 1000));
      setRevealed(false);
      if (reviewPosition >= dueCards.length - 1) { setReviewing(false); setReviewPosition(0); setStatus('Review session complete. Your next dates were saved.'); }
      else setReviewPosition(position => position + 1);
    } catch (reviewError) { setError(errorMessage(reviewError)); }
    finally { setPending(false); }
  };

  const beginReview = () => { setReviewPosition(0); setRevealed(false); setReviewing(true); setStatus(''); };
  const editCard = card => { setEditingCard(card); setCardForm({ question: card.question, answer: card.answer, note_id: card.note_id || '' }); };
  const editDeck = deck => { setEditingDeck(deck); setDeckForm({ title: deck.title, description: deck.description }); };

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8" aria-labelledby="flashcards-title">
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Education</p><h1 id="flashcards-title" className="mt-1 text-3xl font-semibold">EYLO Flashcards</h1><p className="mt-1 text-sm text-muted-foreground">Build your own decks, link cards to research notes, and review with spaced repetition. Ratings update your next review date on the server.</p></header>
    {(error || status) && <div role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl border p-3 text-sm ${error ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/5'}`}>{error || status}{error && <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">Reload</button>}</div>}
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 rounded-2xl border border-border bg-card p-4" aria-label="Flashcard decks">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Your decks</h2><button type="button" onClick={() => { setEditingDeck(null); setDeckForm(emptyDeck); }} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm"><Plus size={15}/>New</button></div>
        {loading ? <p className="py-5 text-sm text-muted-foreground">Loading decks…</p> : decks.length ? <ul className="space-y-2">{decks.map(deck => <li key={deck.id} className={`rounded-xl border p-3 ${deckId === deck.id ? 'border-primary/40 bg-primary/5' : 'border-border'}`}><button type="button" onClick={() => { setDeckId(deck.id); setReviewing(false); setReviewPosition(0); }} className="w-full text-left"><span className="block break-words text-sm font-semibold">{deck.title}</span><span className="mt-1 block text-xs text-muted-foreground">{cards.filter(card => card.deck_id === deck.id).length} cards · {selectDueFlashcards(cards.filter(card => card.deck_id === deck.id)).length} due</span></button><div className="mt-2 flex gap-1"><button type="button" onClick={() => editDeck(deck)} aria-label={`Edit deck ${deck.title}`} className="rounded p-2 text-muted-foreground hover:bg-muted"><Pencil size={14}/></button><button type="button" onClick={() => deleteDeck(deck)} aria-label={`Delete deck ${deck.title}`} className="rounded p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14}/></button></div></li>)}</ul> : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Create a deck to start collecting cards.</p>}
        <form onSubmit={saveDeck} className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">{editingDeck ? 'Edit deck' : 'Create a deck'}</h3><label className="block text-xs font-medium text-muted-foreground" htmlFor="deck-title">Deck name<input id="deck-title" required maxLength={120} value={deckForm.title} onChange={event => setDeckForm({ ...deckForm, title: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="block text-xs font-medium text-muted-foreground" htmlFor="deck-description">Description<textarea id="deck-description" maxLength={1000} rows={2} value={deckForm.description} onChange={event => setDeckForm({ ...deckForm, description: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" /></label><div className="flex gap-2"><button disabled={pending} className="min-h-10 flex-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pending ? 'Saving…' : 'Save deck'}</button>{editingDeck && <button type="button" onClick={() => { setEditingDeck(null); setDeckForm(emptyDeck); }} aria-label="Cancel edit deck" className="rounded-lg border border-border px-3"><X size={16}/></button>}</div></form>
      </aside>
      <section className="min-w-0 space-y-5">
        {!selectedDeck ? <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center"><BookOpen size={24} className="mx-auto text-muted-foreground"/><h2 className="mt-3 font-semibold">Choose or create a deck</h2><p className="mt-1 text-sm text-muted-foreground">Cards and review schedules stay private to your account.</p></div> : <>
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6"><div><h2 className="text-xl font-semibold">{selectedDeck.title}</h2>{selectedDeck.description && <p className="mt-1 text-sm text-muted-foreground">{selectedDeck.description}</p>}<p className="mt-2 text-xs text-muted-foreground">{deckCards.length} cards · {dueCards.length} due now · {reviews.length} recent reviews</p></div><button type="button" onClick={beginReview} disabled={!dueCards.length || reviewing} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><RotateCcw size={16}/>Review {dueCards.length} due</button></div>
          {reviewing && activeCard && <article className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-8" aria-labelledby="review-heading"><div className="flex items-center justify-between gap-3"><p id="review-heading" className="text-xs font-semibold uppercase tracking-wider text-primary">Review {reviewPosition + 1} of {dueCards.length}</p><button type="button" onClick={() => { setReviewing(false); setRevealed(false); }} className="rounded-lg border border-border px-3 py-2 text-sm">End session</button></div><div className="mx-auto max-w-2xl py-10 text-center"><h3 className="whitespace-pre-wrap break-words text-xl font-semibold sm:text-2xl">{activeCard.question}</h3>{revealed ? <div className="mt-6 border-t border-border pt-6"><p className="whitespace-pre-wrap break-words text-base leading-7">{activeCard.answer}</p>{activeCard.note_id && <p className="mt-4 text-xs text-muted-foreground">Source note: {notes.find(note => note.id === activeCard.note_id)?.title || 'Linked note'}</p>}</div> : <button type="button" onClick={() => setRevealed(true)} className="mt-7 min-h-11 rounded-xl border border-border px-5 text-sm font-semibold">Show answer</button>}</div>{revealed && <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">{[{ rating: 1, label: 'Again', help: '1 day' }, { rating: 3, label: 'Hard', help: 'Short interval' }, { rating: 4, label: 'Good', help: 'Normal interval' }, { rating: 5, label: 'Easy', help: 'Longer interval' }].map(option => <button key={option.rating} type="button" onClick={() => rateCard(option.rating)} disabled={pending} className="min-h-14 rounded-xl border border-border px-3 py-2 text-left hover:border-primary/50 disabled:opacity-60"><span className="block text-sm font-semibold">{pending ? 'Saving…' : option.label}</span><span className="text-xs text-muted-foreground">{option.help}</span></button>)}</div>}</article>}
          {reviewing && !activeCard && <p className="rounded-xl border border-border p-4 text-sm">No due cards remain in this session.</p>}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><h3 className="mb-4 text-lg font-semibold">Cards</h3>{deckCards.length ? <ul className="space-y-3">{deckCards.map(card => <li key={card.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words font-medium">{card.question}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{card.answer}</p><p className="mt-3 text-xs text-muted-foreground">{Date.parse(card.due_at) <= Date.now() ? 'Due now' : `Next review ${new Date(card.due_at).toLocaleDateString()}`} · {card.repetitions} successful reviews</p>{card.note_id && <p className="mt-1 text-xs text-primary">From note: {notes.find(note => note.id === card.note_id)?.title || 'Linked note'}</p>}</div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => editCard(card)} aria-label={`Edit card ${card.question}`} className="rounded-lg p-2 hover:bg-muted"><Pencil size={15}/></button><button type="button" onClick={() => deleteCard(card)} aria-label={`Delete card ${card.question}`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={15}/></button></div></div></li>)}</ul> : <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="font-medium">No cards in this deck yet.</p><p className="mt-1 text-sm text-muted-foreground">Add a question and answer, optionally linked to one of your notes.</p></div>}</section>
            <form onSubmit={saveCard} className="h-fit space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6"><h3 className="text-lg font-semibold">{editingCard ? 'Edit flashcard' : 'Add flashcard'}</h3><label className="block text-xs font-medium text-muted-foreground" htmlFor="card-question">Question<textarea id="card-question" required maxLength={2000} rows={4} value={cardForm.question} onChange={event => setCardForm({ ...cardForm, question: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="What is the primary outcome?" /></label><label className="block text-xs font-medium text-muted-foreground" htmlFor="card-answer">Answer<textarea id="card-answer" required maxLength={5000} rows={5} value={cardForm.answer} onChange={event => setCardForm({ ...cardForm, answer: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Write the answer you want to remember." /></label><label className="block text-xs font-medium text-muted-foreground" htmlFor="card-note">Research note (optional)<select id="card-note" value={cardForm.note_id} onChange={event => setCardForm({ ...cardForm, note_id: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No linked note</option>{notes.map(note => <option key={note.id} value={note.id}>{note.title || 'Untitled note'}</option>)}</select></label><button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pending ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>}{editingCard ? 'Save changes' : 'Save flashcard'}</button>{editingCard && <button type="button" onClick={() => { setEditingCard(null); setCardForm(emptyCard); }} className="min-h-10 w-full rounded-lg border border-border text-sm">Cancel edit</button>}</form>
          </div>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><h3 className="mb-3 font-semibold">Recent review activity</h3>{reviews.length ? <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{reviews.slice(0, 9).map(review => <li key={review.id} className="rounded-lg bg-muted/50 p-3 text-xs"><span className="font-medium">{deckCards.find(card => card.id === review.flashcard_id)?.question || 'Reviewed card'}</span><span className="mt-1 block text-muted-foreground">Rated {review.rating}/5 · {new Date(review.reviewed_at).toLocaleString()}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Your completed review sessions will be recorded here.</p>}</section>
        </>}
      </section>
    </div>
  </main>;
}
