import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronRight, Clock3, FileText, Flag, Layers3, Plus, Search, Sparkles, Target, Trash2 } from 'lucide-react';
import { learningWorkspace } from '@/services/learning-workspace';
import { addHabitCheckin, examRevisionDates, nextRecurringTaskDate, nextReview, noteHtmlFromText, noteTextContent, sanitizeNoteHtml, scoreMultipleChoice } from '@/lib/learning-workspace.mjs';

const TABS = [
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'life', label: 'Life', icon: Target },
  { id: 'planner', label: 'Study planner', icon: BookOpen },
  { id: 'cards', label: 'Flashcards', icon: Layers3 },
  { id: 'quizzes', label: 'Quizzes', icon: Flag },
];
const blankNote = () => ({ title: '', body: '', tags: '', subject: '', notebook: '', pinned: false, favorite: false });
const NOTE_TEMPLATES = Object.freeze({
  lecture: { title: 'Lecture notes', body: '<h2>Overview</h2><p></p><h2>Key concepts</h2><ul><li></li></ul><h2>Questions to revisit</h2><ul><li></li></ul>' },
  reading: { title: 'Reading summary', body: '<h2>Source</h2><p></p><h2>Purpose and methods</h2><p></p><h2>Main findings</h2><ul><li></li></ul><h2>Limitations and questions</h2><p></p>' },
  research: { title: 'Research idea', body: '<h2>Research question</h2><p></p><h2>Evidence gap</h2><p></p><h2>Hypothesis</h2><p></p><h2>Possible method</h2><p></p>' },
  reflection: { title: 'Weekly reflection', body: '<h2>What moved forward?</h2><p></p><h2>What was difficult?</h2><p></p><h2>Next small step</h2><p></p>' },
});
const dateOnly = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function RichNoteEditor({ noteId, resetToken, value, onChange }) {
  const editorRef = useRef(null);
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = noteHtmlFromText(value);
  }, [noteId, resetToken]);
  const handleInput = () => {
    if (!editorRef.current) return;
    const safe = sanitizeNoteHtml(editorRef.current.innerHTML);
    if (safe !== editorRef.current.innerHTML) editorRef.current.innerHTML = safe;
    onChange(safe);
  };
  const format = (command, valueArg) => {
    editorRef.current?.focus();
    document.execCommand(command, false, valueArg);
    handleInput();
  };
  return <><div className="mb-1 flex flex-wrap gap-1 rounded-t-lg border border-border bg-secondary/40 p-1" role="toolbar" aria-label="Note formatting"><button type="button" onClick={() => format('bold')} className="rounded px-2 py-1 text-xs font-bold hover:bg-card" aria-label="Bold selection">B</button><button type="button" onClick={() => format('italic')} className="rounded px-2 py-1 text-xs italic hover:bg-card" aria-label="Italic selection">I</button><button type="button" onClick={() => format('underline')} className="rounded px-2 py-1 text-xs underline hover:bg-card" aria-label="Underline selection">U</button><button type="button" onClick={() => format('formatBlock', 'h2')} className="rounded px-2 py-1 text-xs hover:bg-card" aria-label="Insert heading">Heading</button><button type="button" onClick={() => format('insertUnorderedList')} className="rounded px-2 py-1 text-xs hover:bg-card" aria-label="Insert bulleted list">Bulleted list</button><button type="button" onClick={() => format('insertOrderedList')} className="rounded px-2 py-1 text-xs hover:bg-card" aria-label="Insert numbered list">Numbered list</button></div><div ref={editorRef} role="textbox" aria-label="Note content" aria-placeholder="Write a detailed note" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={handleInput} data-placeholder="Write a detailed note… Use Ctrl+B for bold, Ctrl+I for italic." className="learning-rich-editor mb-3 min-h-64 w-full rounded-b-lg border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-primary/40" /></>;
}

export default function LearningWorkspace() {
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('notes');
  const [activeNote, setActiveNote] = useState(null);
  const [editorResetToken, setEditorResetToken] = useState(0);
  const [noteDraft, setNoteDraft] = useState(blankNote());
  const [noteHistory, setNoteHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notebookName, setNotebookName] = useState('');
  const [selectedNotebook, setSelectedNotebook] = useState('all');
  const [showArchivedNotes, setShowArchivedNotes] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Loading your workspace…');
  const [error, setError] = useState('');
  const [noteConflict, setNoteConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [studyGoalTitle, setStudyGoalTitle] = useState('');
  const [studyGoalSubject, setStudyGoalSubject] = useState('');
  const [studyGoalTarget, setStudyGoalTarget] = useState('5');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('45');
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionType, setSessionType] = useState('study');
  const [sessionSubjectId, setSessionSubjectId] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [revisionSubjectId, setRevisionSubjectId] = useState('');
  const [noteForImport, setNoteForImport] = useState('');
  const [deckName, setDeckName] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('all');
  const [editingCardId, setEditingCardId] = useState(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [card, setCard] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizName, setQuizName] = useState('');
  const [quizPrompt, setQuizPrompt] = useState('');
  const [quizChoices, setQuizChoices] = useState('');
  const [quizAnswer, setQuizAnswer] = useState('0');
  const [quizExplanation, setQuizExplanation] = useState('');
  const [takingQuiz, setTakingQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDue, setGoalDue] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskFilter, setTaskFilter] = useState('open');
  const [taskSearch, setTaskSearch] = useState('');
  const [lifeTarget, setLifeTarget] = useState('4');
  const [habitTitle, setHabitTitle] = useState('');
  const [lifeRecurrence, setLifeRecurrence] = useState('none');

  const refresh = useCallback(async () => {
    try {
      setError('');
      const all = await learningWorkspace.list();
      setRecords(all);
      setStatus('All changes save to your account.');
    } catch (cause) {
      setError(cause?.message || 'We could not load your learning workspace. Try again.');
      setStatus('Not connected');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const recordsOf = useCallback((kind) => records.filter((record) => record.kind === kind), [records]);
  const subjects = recordsOf('subject');
  const notebooks = recordsOf('notebook');
  const notes = useMemo(() => recordsOf('note').filter((record) => {
    if (Boolean(record.data.archived_at) !== showArchivedNotes) return false;
    const needle = search.trim().toLowerCase();
    return !needle || `${record.data.title} ${noteTextContent(record.data.body)} ${record.data.tags}`.toLowerCase().includes(needle);
  }).filter((record) => selectedNotebook === 'all' || record.data.notebook_id === selectedNotebook)
    .sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || (b.updated_date || '').localeCompare(a.updated_date || '')), [recordsOf, search, selectedNotebook, showArchivedNotes]);
  const decks = recordsOf('deck');
  const everyCard = recordsOf('flashcard');
  const allCards = selectedDeckId === 'all' ? everyCard : everyCard.filter((item) => item.parent_id === selectedDeckId);
  const dueCards = allCards.filter((item) => !item.data.due_at || new Date(item.data.due_at) <= new Date());
  const activeNoteRecord = records.find((item) => item.id === activeNote);
  const sessions = recordsOf('study_session').sort((a, b) => (a.data.study_date || '').localeCompare(b.data.study_date || ''));
  const goals = recordsOf('goal');
  const studyGoals = recordsOf('study_goal');
  const habits = recordsOf('habit');
  const tasks = recordsOf('life_task').filter((task) => {
    const matchesState = taskFilter === 'all' || (taskFilter === 'completed' ? task.data.completed : !task.data.completed);
    const matchesSearch = !taskSearch.trim() || String(task.data.title || '').toLowerCase().includes(taskSearch.trim().toLowerCase());
    return matchesState && matchesSearch;
  }).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.data.priority] ?? 1) - ({ high: 0, medium: 1, low: 2 }[b.data.priority] ?? 1) || String(a.data.due_date || '9999-12-31').localeCompare(String(b.data.due_date || '9999-12-31')));
  const quizzes = recordsOf('quiz');
  const attempts = recordsOf('quiz_attempt');

  const run = async (action, success = 'Saved') => {
    setBusy(true); setError('');
    try { await action(); await refresh(); setStatus(success); }
    catch (cause) { setError(cause?.message || 'We could not save this change. Please try again.'); setNoteConflict(cause?.code === 'ENTITY_CONFLICT'); setStatus('Save failed'); }
    finally { setBusy(false); }
  };

  const startNewNote = () => { setActiveNote(null); setNoteDraft(blankNote()); setEditorResetToken((value) => value + 1); };
  const startEditNote = (record) => { setActiveNote(record.id); setNoteDraft({ title: record.data.title || '', body: record.data.body || '', tags: Array.isArray(record.data.tags) ? record.data.tags.join(', ') : record.data.tags || '', subject: record.data.subject_id || '', notebook: record.data.notebook_id || '', pinned: Boolean(record.data.pinned), favorite: Boolean(record.data.favorite) }); setEditorResetToken((value) => value + 1); };
  const saveNote = async (fields = noteDraft) => {
    const payload = { ...fields, title: fields.title.trim() || 'Untitled note', subject_id: fields.subject || null, notebook_id: fields.notebook || null, tags: fields.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
    if (activeNote) {
      if (!activeNoteRecord?.updated_date) throw Object.assign(new Error('Reload the note before editing so we can protect your latest changes.'), { code: 'ENTITY_CONFLICT' });
      await learningWorkspace.update(activeNote, payload, activeNoteRecord.updated_date);
    }
    else { const created = await learningWorkspace.create('note', payload, payload.subject_id || null); setActiveNote(created.id); }
    await refresh();
    setNoteConflict(false);
  };
  const loadLatestNote = async () => {
    if (!activeNote) return;
    try {
      const latest = await learningWorkspace.get(activeNote);
      setRecords((previous) => previous.map((record) => record.id === latest.id ? latest : record));
      startEditNote(latest);
      setNoteConflict(false); setError(''); setStatus('Latest note loaded');
    } catch (cause) { setError(cause?.message || 'Could not load the latest note.'); }
  };
  const loadHistory = async () => {
    if (!activeNote) return;
    setHistoryOpen(true); setError('');
    try { setNoteHistory(await learningWorkspace.history(activeNote)); }
    catch (cause) { setError(cause?.message || 'Could not load note history.'); }
  };
  const restoreNoteVersion = async (version) => {
    const snapshot = noteHistory.find((item) => item.version_number === version)?.snapshot;
    if (!snapshot || !activeNote) return;
    await run(async () => {
      await learningWorkspace.update(activeNote, { ...snapshot, title: snapshot.title || 'Untitled note' }, activeNoteRecord?.updated_date);
      setNoteDraft({ title: snapshot.title || '', body: snapshot.body || '', tags: Array.isArray(snapshot.tags) ? snapshot.tags.join(', ') : '', subject: snapshot.subject_id || '', notebook: snapshot.notebook_id || '', pinned: Boolean(snapshot.pinned), favorite: Boolean(snapshot.favorite) });
      setEditorResetToken((value) => value + 1);
      setHistoryOpen(false);
    }, `Restored version ${version}`);
  };
  const exportNote = () => {
    const markdown = `# ${noteDraft.title || 'Untitled note'}\n\n${noteTextContent(noteDraft.body)}\n\n${noteDraft.tags ? `Tags: ${noteDraft.tags}` : ''}`;
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(noteDraft.title || 'eylo-note').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'eylo-note'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab !== 'notes' || (!activeNote && !noteDraft.title && !noteDraft.body)) return undefined;
    const timer = setTimeout(() => {
      setStatus('Saving…');
      void saveNote().then(() => setStatus('Saved')).catch((cause) => { setError(cause?.message || 'Autosave failed. Your draft is still on screen.'); setNoteConflict(cause?.code === 'ENTITY_CONFLICT'); setStatus('Save failed'); });
    }, 900);
    return () => clearTimeout(timer);
    // Note draft changes are intentionally debounced into a versioned database record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteDraft, activeNote, activeTab]);

  const createRecord = (kind, data, parent = null) => run(async () => { await learningWorkspace.create(kind, data, parent); }, 'Saved to your workspace');
  const deleteRecord = (id) => run(() => learningWorkspace.remove(id), 'Item deleted');
  const completeTask = async (task, completed) => {
    await learningWorkspace.update(task.id, { completed, completed_at: completed ? new Date().toISOString() : null });
    if (completed && task.data.recurrence && task.data.recurrence !== 'none') {
      const dueDate = nextRecurringTaskDate(task.data.due_date || localDayKey(), task.data.recurrence);
      await learningWorkspace.create('life_task', { title: task.data.title, due_date: dueDate, completed: false, recurrence: task.data.recurrence });
    }
  };
  const beginTaskEdit = (task) => {
    setEditingTaskId(task.id); setTaskTitle(task.data.title || ''); setTaskDue(task.data.due_date || '');
    setLifeRecurrence(task.data.recurrence || 'none'); setTaskPriority(task.data.priority || 'medium');
  };
  const saveTask = async (event) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const patch = { title: taskTitle.trim(), due_date: taskDue || null, recurrence: lifeRecurrence, priority: taskPriority };
    await run(async () => {
      if (editingTaskId) await learningWorkspace.update(editingTaskId, patch);
      else await learningWorkspace.create('life_task', { ...patch, completed: false });
      setTaskTitle(''); setTaskDue(''); setTaskPriority('medium'); setLifeRecurrence('none'); setEditingTaskId(null);
    }, editingTaskId ? 'Task updated' : 'Task created');
  };
  const saveStudyGoal = async (event) => {
    event.preventDefault();
    if (!studyGoalTitle.trim() || !studyGoalSubject || Number(studyGoalTarget) < 1) return;
    await run(async () => {
      await learningWorkspace.create('study_goal', { title: studyGoalTitle.trim(), target_sessions: Number(studyGoalTarget), completed_at: null }, studyGoalSubject);
      setStudyGoalTitle(''); setStudyGoalSubject(''); setStudyGoalTarget('5');
    }, 'Study goal created');
  };
  const saveStudySession = async (event) => {
    event.preventDefault();
    if (!sessionSubjectId || !sessionTopic.trim() || !sessionDate) return;
    const payload = { topic: sessionTopic.trim(), study_date: sessionDate, minutes: Number(sessionMinutes), completed: false, session_type: sessionType };
    await run(async () => {
      if (editingSessionId) await learningWorkspace.update(editingSessionId, payload);
      else await learningWorkspace.create('study_session', payload, sessionSubjectId);
      setSessionTopic(''); setSessionDate(''); setSessionMinutes('45'); setSessionType('study'); setSessionSubjectId(''); setEditingSessionId(null);
    }, editingSessionId ? 'Study session rescheduled' : 'Study session scheduled');
  };
  const buildRevisionPlan = async () => {
    const subject = subjects.find((item) => item.id === revisionSubjectId);
    if (!subject?.data.exam_date) { setError('Add an exam date to this subject before building a revision plan.'); return; }
    const dates = examRevisionDates(subject.data.exam_date);
    const missing = dates.filter((date) => !sessions.some((session) => session.parent_id === subject.id && session.data.study_date === date && session.data.session_type === 'revision'));
    if (!missing.length) { setStatus('Revision sessions are already planned for the available dates.'); return; }
    await run(async () => { for (const date of missing) await learningWorkspace.create('study_session', { topic: `Revision: ${subject.data.name}`, study_date: date, minutes: 45, completed: false, session_type: 'revision' }, subject.id); }, `${missing.length} revision sessions added`);
  };

  const addImportedCards = () => {
    const source = records.find((item) => item.id === noteForImport);
    if (!source) return;
    const parsed = noteTextContent(source.data.body || '').split('\n').map((line) => line.split('::').map((part) => part.trim())).filter((parts) => parts.length >= 2 && parts[0] && parts[1]);
    if (!parsed.length) { setError('Add one flashcard per line in your note using “question :: answer”, then import again.'); return; }
    void run(async () => {
      const deck = await learningWorkspace.create('deck', { title: source.data.title || 'Imported from a note', source_note_id: source.id });
      setSelectedDeckId(deck.id);
      for (const [question, answer] of parsed) await learningWorkspace.create('flashcard', { front: question, back: answer, repetitions: 0, interval_days: 0, ease_factor: 2.5, due_at: new Date().toISOString() }, deck.id);
    }, `${parsed.length} card${parsed.length === 1 ? '' : 's'} imported from this note`);
  };

  const beginReview = () => { setCard(dueCards[0] || null); setShowAnswer(false); };
  const gradeCard = (quality) => {
    if (!card) return;
    void run(async () => {
      await learningWorkspace.update(card.id, { ...nextReview(card.data, quality), review_count: Number(card.data.review_count || 0) + 1 });
      const next = dueCards.slice(1)[0]; setCard(next || null); setShowAnswer(false);
    }, 'Review saved');
  };

  const submitQuiz = () => {
    if (!takingQuiz) return;
    const outcome = scoreMultipleChoice(takingQuiz.data.questions || [], quizAnswers);
    setQuizResult(outcome);
    void createRecord('quiz_attempt', { quiz_id: takingQuiz.id, ...outcome, completed_at: new Date().toISOString() }, takingQuiz.id);
  };
  const createMissedQuestionsQuiz = () => {
    if (!takingQuiz || !quizResult) return;
    const questions = quizResult.results.map((result, index) => ({ result, question: takingQuiz.data.questions[index] }))
      .filter(({ result }) => !result.correct).map(({ question }) => question);
    if (!questions.length) return;
    void createRecord('quiz', { title: `${takingQuiz.data.title} · Missed questions`, questions, source_quiz_id: takingQuiz.id });
    setTakingQuiz(null); setQuizResult(null); setQuizAnswers({});
  };

  const importQuizFromNote = (sourceId) => {
    const source = records.find((item) => item.id === sourceId);
    if (!source) return;
    const lines = noteTextContent(source.data.body || '').split('\n').map((line) => line.split('::').map((part) => part.trim()));
    const questions = lines.filter((parts) => parts.length >= 3 && parts[0] && parts[1] && parts[2]).map(([prompt, answer, distractor]) => ({ prompt, choices: [answer, distractor], answer: 0, explanation: 'The correct answer was written first in the source note.' }));
    if (!questions.length) { setError('For quiz import, add lines like “question :: answer :: plausible distractor” to a note.'); return; }
    void createRecord('quiz', { title: `Quiz: ${source.data.title || 'Imported notes'}`, questions, source_note_id: source.id });
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles size={14} /> Your personal learning space</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Learn, plan, and make progress</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Notes, life goals, study sessions, spaced review, and quizzes stay connected and ready when you return.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm" aria-live="polite"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />{status}</div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Learning overview">
        {[['Study subjects', subjects.length, BookOpen], ['Notes', recordsOf('note').length, FileText], ['Cards due', dueCards.length, Layers3], ['Study minutes', sessions.filter((item) => item.data.completed).reduce((sum, item) => sum + Number(item.data.minutes || 0), 0), Clock3]].map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon size={15} /></div><div className="text-2xl font-semibold">{value}{label === 'Study minutes' && <span className="ml-1 text-sm font-normal text-muted-foreground">min</span>}</div></article>)}
      </section>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/40 p-1" aria-label="Learning products">
        {TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${activeTab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Icon size={16} />{label}</button>)}
      </nav>

      {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><span className="min-w-0 flex-1">{error}</span><div className="flex gap-3">{noteConflict && activeNote && <><button type="button" className="underline" onClick={exportNote}>Download draft</button><button type="button" className="underline" onClick={() => void loadLatestNote()}>Load latest version</button></>}<button type="button" className="underline" onClick={() => setError('')}>Dismiss</button></div></div>}
      {historyOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" role="presentation" onClick={() => setHistoryOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="note-history-title" className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 id="note-history-title" className="text-lg font-semibold">Note version history</h2><p className="text-xs text-muted-foreground">Each saved content change creates a recoverable snapshot.</p></div><button type="button" onClick={() => setHistoryOpen(false)} className="rounded-lg border border-border px-3 py-2 text-sm">Close</button></div><div className="space-y-2">{noteHistory.map((version) => <article key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-medium">Version {version.version_number} · {version.snapshot.title || 'Untitled note'}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(version.created_date).toLocaleString()}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{version.snapshot.body}</p></div><button type="button" disabled={version.version_number === noteHistory[0]?.version_number} onClick={() => void restoreNoteVersion(version.version_number)} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Restore</button></article>)}{!noteHistory.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">A version is created when the note is first saved.</p>}</div></section></div>}

      {activeTab === 'notes' && <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Your notes</h2><p className="text-xs text-muted-foreground">Search, tag, pin, and organize study notes</p></div><div className="flex flex-wrap gap-2"><select defaultValue="" aria-label="Start note from a template" onChange={(event) => { const template = NOTE_TEMPLATES[event.target.value]; if (!template) return; if (activeNote || noteDraft.title || noteDraft.body) { setError('Save or start a new note before applying a template.'); event.target.value = ''; return; } startNewNote(); setNoteDraft({ ...blankNote(), ...template }); event.target.value = ''; }} className="min-h-10 max-w-40 rounded-lg border border-border bg-background px-2 text-xs"><option value="">Templates</option><option value="lecture">Lecture notes</option><option value="reading">Reading summary</option><option value="research">Research idea</option><option value="reflection">Weekly reflection</option></select><button type="button" onClick={startNewNote} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus size={16} /> New note</button></div></div>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3"><Search size={15} className="text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-10 w-full bg-transparent text-sm outline-none" placeholder="Search notes and tags" aria-label="Search notes" /></label>
          <div className="mb-3 flex gap-2"><select value={selectedNotebook} onChange={(event) => setSelectedNotebook(event.target.value)} className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" aria-label="Filter notes by notebook"><option value="all">All notebooks</option>{notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.data.name}</option>)}</select><form className="flex min-w-0 flex-1 gap-1" onSubmit={(event) => { event.preventDefault(); if (notebookName.trim()) { void createRecord('notebook', { name: notebookName.trim() }); setNotebookName(''); } }}><input value={notebookName} onChange={(event) => setNotebookName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" placeholder="New notebook" aria-label="New notebook name" /><button className="rounded-lg border border-border px-2" aria-label="Create notebook"><Plus size={14} /></button></form></div>
          <button type="button" onClick={() => { setShowArchivedNotes((value) => !value); startNewNote(); }} className="mb-2 rounded-lg border border-border px-3 py-2 text-xs">{showArchivedNotes ? 'Back to notes' : 'Trash'}</button><div className="max-h-[32rem] space-y-2 overflow-y-auto">{notes.map((item) => <button key={item.id} onClick={() => startEditNote(item)} className={`w-full rounded-xl border p-3 text-left transition-colors ${item.id === activeNote ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-secondary/50'}`}><div className="flex justify-between gap-2"><span className="truncate text-sm font-semibold">{item.data.pinned ? '📌 ' : ''}{item.data.title || 'Untitled note'}</span><span className="shrink-0 text-[11px] text-muted-foreground">{dateOnly(item.updated_date)}</span></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.data.body || 'Start writing…'}</p><div className="mt-2 flex flex-wrap gap-1">{(Array.isArray(item.data.tags) ? item.data.tags : []).map((tag) => <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{tag}</span>)}</div></button>)}{!notes.length && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{search ? 'No notes match this search.' : 'Start with a lecture note, idea, or reading summary.'}</div>}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{activeNoteRecord ? 'Edit note' : 'New note'}</h2><p className="text-xs text-muted-foreground">Autosave · Markdown formatting · version history</p></div><div className="flex gap-2"><button type="button" onClick={() => setNoteDraft((prev) => ({ ...prev, pinned: !prev.pinned }))} className={`rounded-lg border px-3 py-2 text-xs ${noteDraft.pinned ? 'border-primary text-primary' : 'border-border'}`}>{noteDraft.pinned ? 'Pinned' : 'Pin'}</button><button type="button" onClick={() => setNoteDraft((prev) => ({ ...prev, favorite: !prev.favorite }))} className={`rounded-lg border px-3 py-2 text-xs ${noteDraft.favorite ? 'border-primary text-primary' : 'border-border'}`}>{noteDraft.favorite ? '★ Favorite' : '☆ Favorite'}</button>{activeNote && <><button type="button" onClick={() => void loadHistory()} className="rounded-lg border border-border px-3 py-2 text-xs">History</button>{activeNoteRecord?.data.archived_at ? <button type="button" onClick={() => void run(async () => { await learningWorkspace.update(activeNote, { archived_at: null }, activeNoteRecord.updated_date); setShowArchivedNotes(false); startNewNote(); }, 'Note restored')} className="rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary">Restore</button> : <button type="button" aria-label="Move note to trash" onClick={() => void run(async () => { await learningWorkspace.update(activeNote, { archived_at: new Date().toISOString() }, activeNoteRecord.updated_date); startNewNote(); }, 'Note moved to trash')} className="rounded-lg border border-destructive/40 px-3 text-destructive"><Trash2 size={15} /></button>}</>}</div></div>
          <label className="mb-3 block text-xs font-medium text-muted-foreground">Title<input value={noteDraft.title} onChange={(event) => setNoteDraft((prev) => ({ ...prev, title: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/40" placeholder="A clear title for this note" /></label>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Content</label><RichNoteEditor noteId={activeNote} resetToken={editorResetToken} value={noteDraft.body} onChange={(body) => setNoteDraft((prev) => ({ ...prev, body }))} />
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium text-muted-foreground">Tags, separated by commas<input value={noteDraft.tags} onChange={(event) => setNoteDraft((prev) => ({ ...prev, tags: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" placeholder="lecture, exam 1" /></label><label className="text-xs font-medium text-muted-foreground">Subject<select value={noteDraft.subject} onChange={(event) => setNoteDraft((prev) => ({ ...prev, subject: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">Personal notes</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.data.name}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Notebook<select value={noteDraft.notebook} onChange={(event) => setNoteDraft((prev) => ({ ...prev, notebook: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">No notebook</option>{notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.data.name}</option>)}</select></label></div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void run(() => saveNote(), 'Note saved')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"><Check size={15} /> Save now</button><button type="button" onClick={exportNote} disabled={!noteDraft.title && !noteDraft.body} className="min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50">Export Markdown</button></div>
        </div>
      </section>}

      {activeTab === 'life' && <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Goals and milestones</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Choose a measurable target and update progress as you go.</p><form className="mb-4 grid gap-2 sm:grid-cols-[1fr_7rem_8rem_auto]" onSubmit={(event) => { event.preventDefault(); if (goalTitle.trim()) { void createRecord('goal', { title: goalTitle.trim(), target: Math.max(1, Number(lifeTarget) || 1), progress: 0, target_date: goalDue || null, created_at: new Date().toISOString() }); setGoalTitle(''); setGoalDue(''); } }}><input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Finish my statistics course" aria-label="Goal title" /><input type="number" min="1" value={lifeTarget} onChange={(event) => setLifeTarget(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-2 text-xs" aria-label="Goal milestone target" /><input type="date" value={goalDue} onChange={(event) => setGoalDue(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-2 text-xs" aria-label="Goal target date" /><button className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" aria-label="Create goal"><Plus size={15} /></button></form><div className="space-y-3">{goals.map((goal) => <article key={goal.id} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-2"><div><span className="text-sm font-medium">{goal.data.title}</span><span className="ml-2 text-[11px] text-muted-foreground">{dateOnly(goal.data.target_date)}</span></div><button type="button" onClick={() => void run(() => { const target = Number(goal.data.target || 1); const progress = Math.min(target, Number(goal.data.progress || 0) + 1); const at = new Date().toISOString(); return learningWorkspace.update(goal.id, { progress, progress_history: [...(goal.data.progress_history || []), { value: progress, at }], completed_at: progress >= target ? at : null }); }, 'Progress updated')} disabled={Number(goal.data.progress || 0) >= Number(goal.data.target || 1)} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50">{Number(goal.data.progress || 0) >= Number(goal.data.target || 1) ? 'Complete' : `${goal.data.progress || 0}/${goal.data.target || 1} · Add progress`}</button></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${Math.min(100, 100 * Number(goal.data.progress || 0) / Number(goal.data.target || 1))}%` }} /></div></article>)}{!goals.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Create your first goal. Progress only changes when you update it.</p>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Daily tasks</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">A simple list for the things that move your goals forward.</p><form className="mb-4 grid gap-2 sm:grid-cols-2" onSubmit={saveTask}><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder={editingTaskId ? 'Edit task name' : 'Add a task'} aria-label="Task title" /><input type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-2 text-xs" aria-label="Task due date" /><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} aria-label="Task priority" className="min-h-10 rounded-lg border border-border bg-background px-2 text-xs"><option value="high">High priority</option><option value="medium">Normal priority</option><option value="low">Low priority</option></select><select value={lifeRecurrence} onChange={(event) => setLifeRecurrence(event.target.value)} aria-label="Task recurrence" className="min-h-10 rounded-lg border border-border bg-background px-2 text-xs"><option value="none">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select><div className="flex gap-2 sm:col-span-2"><button className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">{editingTaskId ? 'Save task' : 'Add task'}</button>{editingTaskId && <button type="button" onClick={() => { setEditingTaskId(null); setTaskTitle(''); setTaskDue(''); }} className="rounded-lg border border-border px-3 text-sm">Cancel</button>}</div></form><div className="mb-2 flex gap-2"><input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} className="min-h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs" placeholder="Find tasks" aria-label="Search tasks" /><select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)} aria-label="Filter tasks" className="min-h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value="open">Open</option><option value="completed">Completed</option><option value="all">All tasks</option></select></div><div className="space-y-2">{tasks.map((task) => <article key={task.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" checked={Boolean(task.data.completed)} onChange={(event) => void run(() => completeTask(task, event.target.checked), task.data.recurrence !== 'none' && !task.data.completed ? 'Task completed and repeated' : 'Task updated')} aria-label={`Mark ${task.data.title} complete`} className="h-4 w-4 accent-primary" /><span className={`min-w-32 flex-1 text-sm ${task.data.completed ? 'text-muted-foreground line-through' : ''}`}>{task.data.title}<span className="ml-2 text-[10px] text-muted-foreground">{task.data.recurrence !== 'none' ? `Repeats ${task.data.recurrence}` : ''}</span><span className={`ml-2 text-[10px] ${task.data.priority === 'high' ? 'text-amber-400' : 'text-muted-foreground'}`}>{task.data.priority || 'normal'}</span></span><span className="text-[11px] text-muted-foreground">{dateOnly(task.data.due_date)}</span><button type="button" onClick={() => beginTaskEdit(task)} aria-label={`Edit ${task.data.title}`} className="text-xs text-primary">Edit</button><button type="button" onClick={() => void deleteRecord(task.id)} aria-label={`Delete ${task.data.title}`} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></article>)}{!tasks.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No tasks yet. Add one small next step.</p>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">Daily habits</h2><p className="mt-1 text-xs text-muted-foreground">Check-ins are dated so your history reflects what you actually did.</p></div><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (habitTitle.trim()) { void createRecord('habit', { title: habitTitle.trim(), cadence: 'daily', checkins: [] }); setHabitTitle(''); } }}><input value={habitTitle} onChange={(event) => setHabitTitle(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Review notes for 10 minutes" aria-label="Habit title" /><button className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" aria-label="Create daily habit"><Plus size={15} /></button></form></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{habits.map((habit) => { const checkins = Array.isArray(habit.data.checkins) ? habit.data.checkins : []; const checkedToday = checkins.includes(localDayKey()); return <article key={habit.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{habit.data.title}</p><p className="mt-1 text-xs text-muted-foreground">{checkins.length} completed day{checkins.length === 1 ? '' : 's'} · daily</p></div><button type="button" disabled={checkedToday} onClick={() => void run(() => learningWorkspace.update(habit.id, { checkins: addHabitCheckin(checkins) }), 'Habit check-in saved')} className="rounded-lg border border-border px-3 py-2 text-xs disabled:text-emerald-400">{checkedToday ? 'Done today' : 'Check in'}</button><button type="button" aria-label={`Delete habit ${habit.data.title}`} onClick={() => void deleteRecord(habit.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></article>; })}{!habits.length && <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground sm:col-span-2">Add a daily habit and record each check-in.</p>}</div></div>
      </section>}

      {activeTab === 'planner' && <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Subjects and exams</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Your plan and notes reconnect through the same subject.</p><form onSubmit={(event) => { event.preventDefault(); if (subjectName.trim()) { void createRecord('subject', { name: subjectName.trim(), exam_date: examDate || null }); setSubjectName(''); setExamDate(''); } }} className="space-y-2"><input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Subject name" aria-label="Subject name" /><input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" aria-label="Exam date" /><button className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Add subject</button></form><div className="mt-4 space-y-2">{subjects.map((subject) => <article key={subject.id} className="rounded-xl border border-border p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{subject.data.name}</strong><button type="button" aria-label={`Delete ${subject.data.name}`} onClick={() => void deleteRecord(subject.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></div><div className="mt-1 text-xs text-muted-foreground">Exam · {dateOnly(subject.data.exam_date)}</div><div className="mt-2 text-[11px] text-muted-foreground">{records.filter((record) => record.data.subject_id === subject.id).length} linked notes</div></article>)}</div></div>
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Study sessions</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Plan a session and keep a persistent study history.</p>
          <form onSubmit={saveStudyGoal} className="mb-4 grid gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_120px_auto]">
            <input value={studyGoalTitle} onChange={(event) => setStudyGoalTitle(event.target.value)} required className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Goal, e.g. finish cell biology" aria-label="Study goal" />
            <select value={studyGoalSubject} onChange={(event) => setStudyGoalSubject(event.target.value)} required className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" aria-label="Subject for study goal"><option value="">Choose subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.data.name}</option>)}</select>
            <input type="number" min="1" max="100" value={studyGoalTarget} onChange={(event) => setStudyGoalTarget(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" aria-label="Target completed sessions" />
            <button className="min-h-10 rounded-lg border border-border px-3 text-sm font-medium">Add goal</button>
          </form>
          {!!studyGoals.length && <div className="mb-4 grid gap-2 sm:grid-cols-2">{studyGoals.map((goal) => { const linked = sessions.filter((session) => session.parent_id === goal.parent_id && session.data.completed); const target = Math.max(1, Number(goal.data.target_sessions) || 1); const count = Math.min(linked.length, target); return <article key={goal.id} className="rounded-xl border border-border p-3"><div className="flex justify-between gap-2 text-sm"><strong>{goal.data.title}</strong><span className="text-muted-foreground">{count}/{target}</span></div><p className="mt-1 text-[11px] text-muted-foreground">{subjects.find((subject) => subject.id === goal.parent_id)?.data.name || 'Subject'} · based on completed sessions</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(count / target * 100)}%` }} /></div></article>; })}</div>}
          <form onSubmit={saveStudySession} className="grid gap-2 sm:grid-cols-2"><select value={sessionSubjectId} onChange={(event) => setSessionSubjectId(event.target.value)} required disabled={Boolean(editingSessionId)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"><option value="">Choose a subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.data.name}</option>)}</select><input value={sessionTopic} onChange={(event) => setSessionTopic(event.target.value)} required className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Topic or revision task" aria-label="Study topic" /><select value={sessionType} onChange={(event) => setSessionType(event.target.value)} aria-label="Session type" className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="study">New material</option><option value="revision">Revision</option><option value="practice">Practice problems</option></select><input type="date" required value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" aria-label="Study date" /><input type="number" min="5" max="600" required value={sessionMinutes} onChange={(event) => setSessionMinutes(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" aria-label="Planned minutes" /><div className="flex gap-2 sm:col-span-2"><button className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">{editingSessionId ? 'Save session' : 'Schedule session'}</button>{editingSessionId && <button type="button" onClick={() => { setEditingSessionId(null); setSessionTopic(''); setSessionDate(''); setSessionSubjectId(''); }} className="rounded-lg border border-border px-3 text-sm">Cancel</button>}</div></form>
          <div className="mt-3 flex flex-wrap gap-2"><select value={revisionSubjectId} onChange={(event) => setRevisionSubjectId(event.target.value)} aria-label="Choose subject for revision plan" className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Build exam revision plan…</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.data.name} · {dateOnly(subject.data.exam_date)}</option>)}</select><button type="button" onClick={() => void buildRevisionPlan()} disabled={!revisionSubjectId} className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-40">Add 7/3/1 day sessions</button></div>
          <div className="mt-5 space-y-2">{sessions.map((session) => { const subject = subjects.find((item) => item.id === session.parent_id); return <article key={session.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" checked={Boolean(session.data.completed)} onChange={(event) => void run(() => learningWorkspace.update(session.id, { completed: event.target.checked, completed_at: event.target.checked ? new Date().toISOString() : null }), 'Study history updated')} aria-label={`Mark ${session.data.topic} complete`} className="h-4 w-4 accent-primary" /><span className="min-w-40 flex-1 text-sm font-medium">{session.data.topic}<span className="mt-1 block text-[11px] font-normal text-muted-foreground">{subject?.data.name || 'Subject'} · {dateOnly(session.data.study_date)} · {session.data.session_type || 'study'}</span></span><span className="text-xs text-muted-foreground">{session.data.minutes} min</span><button type="button" onClick={() => setActiveTab('notes')} className="text-xs text-primary">Notes</button><button type="button" onClick={() => { setSelectedDeckId('all'); setActiveTab('cards'); }} className="text-xs text-primary">Flashcards</button><button type="button" onClick={() => setActiveTab('quizzes')} className="text-xs text-primary">Quizzes</button>{!session.data.completed && <button type="button" onClick={() => { setEditingSessionId(session.id); setSessionSubjectId(session.parent_id || ''); setSessionTopic(session.data.topic || ''); setSessionDate(session.data.study_date || ''); setSessionMinutes(String(session.data.minutes || 45)); setSessionType(session.data.session_type || 'study'); }} className="text-xs text-primary">Reschedule</button>}</article>; })}{!sessions.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Your scheduled sessions will appear here.</p>}</div></div>
      </section>}

      {activeTab === 'cards' && <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Create flashcards</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Create and edit cards inside named collections.</p><form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (deckName.trim()) { void run(async () => { const created = await learningWorkspace.create('deck', { title: deckName.trim() }); setSelectedDeckId(created.id); setDeckName(''); }, 'Collection created'); } }}><input value={deckName} onChange={(event) => setDeckName(event.target.value)} className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm" placeholder="New collection name" aria-label="New flashcard collection" /><button className="rounded-lg border border-border px-3 text-sm">Create</button></form><label className="mb-3 block text-xs text-muted-foreground">Collection<select value={selectedDeckId} onChange={(event) => setSelectedDeckId(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="all">All collections</option>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.data.title}</option>)}</select></label><form onSubmit={(event) => { event.preventDefault(); if (front.trim() && back.trim()) { void run(async () => { let deck = decks.find((item) => item.id === selectedDeckId) || decks[0]; if (!deck) deck = await learningWorkspace.create('deck', { title: 'My flashcards' }); if (editingCardId) await learningWorkspace.update(editingCardId, { front: front.trim(), back: back.trim() }); else await learningWorkspace.create('flashcard', { front: front.trim(), back: back.trim(), repetitions: 0, interval_days: 0, ease_factor: 2.5, review_count: 0, due_at: new Date().toISOString() }, deck.id); setFront(''); setBack(''); setEditingCardId(null); }, editingCardId ? 'Flashcard updated' : 'Flashcard saved'); } }} className="space-y-2"><input value={front} onChange={(event) => setFront(event.target.value)} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Front · question or prompt" aria-label="Flashcard front" /><textarea value={back} onChange={(event) => setBack(event.target.value)} className="min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Back · answer or explanation" aria-label="Flashcard back" /><div className="flex gap-2"><button className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">{editingCardId ? 'Save card' : 'Add card'}</button>{editingCardId && <button type="button" onClick={() => { setEditingCardId(null); setFront(''); setBack(''); }} className="rounded-lg border border-border px-3 text-sm">Cancel</button>}</div></form><div className="my-5 border-t border-border" /><label className="block text-xs font-medium text-muted-foreground">Import from a note written with “question :: answer” lines<select value={noteForImport} onChange={(event) => setNoteForImport(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">Select a note</option>{recordsOf('note').map((item) => <option key={item.id} value={item.id}>{item.data.title || 'Untitled note'}</option>)}</select></label><button type="button" onClick={addImportedCards} disabled={!noteForImport} className="mt-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">Import cards</button></div>
        <div className="rounded-2xl border border-border bg-card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Review session</h2><p className="mt-1 text-xs text-muted-foreground">{dueCards.length} due · {allCards.length} total · scheduling uses SM-2 intervals</p></div><button type="button" onClick={beginReview} disabled={!dueCards.length} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Start review</button></div>{card ? <article className="mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center"><p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Card {allCards.findIndex((item) => item.id === card.id) + 1} of {allCards.length}</p><h3 className="text-xl font-semibold">{card.data.front}</h3>{showAnswer ? <><div className="my-5 rounded-xl bg-card p-4 text-base">{card.data.back}</div><p className="mb-3 text-xs text-muted-foreground">How well did you recall this?</p><div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => gradeCard(1)} className="rounded-lg border border-border px-3 py-2 text-sm">Again</button><button type="button" onClick={() => gradeCard(3)} className="rounded-lg border border-border px-3 py-2 text-sm">Hard</button><button type="button" onClick={() => gradeCard(4)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Good</button><button type="button" onClick={() => gradeCard(5)} className="rounded-lg border border-border px-3 py-2 text-sm">Easy</button></div></> : <button type="button" onClick={() => setShowAnswer(true)} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm"><ChevronRight size={15} /> Show answer</button>}</article> : <div className="rounded-xl border border-dashed border-border p-8 text-center"><Check size={22} className="mx-auto mb-2 text-emerald-400" /><p className="font-medium">{allCards.length && !dueCards.length ? 'You are caught up for today.' : 'Your review session is ready.'}</p><p className="mt-1 text-xs text-muted-foreground">New cards become due immediately. Each review saves its next due date.</p></div>}{allCards.length > 0 && <div className="mt-5 max-h-64 space-y-2 overflow-y-auto">{allCards.map((item) => <article key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-sm font-medium">{item.data.front}</p><p className="mt-1 text-xs text-muted-foreground">Due {dateOnly(item.data.due_at)} · reviewed {item.data.review_count || 0} times</p></div><div className="flex shrink-0 items-center gap-3"><button type="button" onClick={() => { setEditingCardId(item.id); setFront(item.data.front || ''); setBack(item.data.back || ''); setSelectedDeckId(item.parent_id || 'all'); }} className="text-xs text-primary">Edit</button><button type="button" aria-label="Delete flashcard" onClick={() => void deleteRecord(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></div></article>)}</div>}</div>
      </section>}

      {activeTab === 'quizzes' && <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Build a quiz</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Write questions and explanations yourself, or import question lines from your notes.</p><form onSubmit={(event) => { event.preventDefault(); const choices = quizChoices.split('\n').map((choice) => choice.trim()).filter(Boolean); if (!quizPrompt.trim() || choices.length < 2 || choices.length > 8 || !Number.isInteger(Number(quizAnswer)) || Number(quizAnswer) < 0 || Number(quizAnswer) >= choices.length) { setError('Add a question, 2–8 answer choices, and a valid correct-answer index.'); return; } const quiz = records.find((item) => item.kind === 'quiz' && item.data.title === quizName.trim()); const question = { prompt: quizPrompt.trim(), choices, answer: Number(quizAnswer), explanation: quizExplanation.trim() }; void run(async () => { if (quiz) await learningWorkspace.update(quiz.id, { questions: [...(quiz.data.questions || []), question] }); else await learningWorkspace.create('quiz', { title: quizName.trim() || 'My quiz', questions: [question] }); setQuizPrompt(''); setQuizChoices(''); setQuizAnswer('0'); setQuizExplanation(''); }, 'Question saved'); }} className="space-y-2"><input value={quizName} onChange={(event) => setQuizName(event.target.value)} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Quiz name" aria-label="Quiz name" /><textarea value={quizPrompt} onChange={(event) => setQuizPrompt(event.target.value)} className="min-h-16 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Question" aria-label="Quiz question" /><textarea value={quizChoices} onChange={(event) => setQuizChoices(event.target.value)} className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder={'One answer choice per line\nChoice A\nChoice B'} aria-label="Answer choices" /><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Correct choice number<input type="number" min="0" value={quizAnswer} onChange={(event) => setQuizAnswer(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><input value={quizExplanation} onChange={(event) => setQuizExplanation(event.target.value)} className="min-h-10 self-end rounded-lg border border-border bg-background px-3 text-sm" placeholder="Why is it correct?" aria-label="Answer explanation" /></div><button className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Save question</button></form><div className="my-5 border-t border-border" /><label className="block text-xs text-muted-foreground">Create questions from a note with “question :: answer :: distractor” lines<select onChange={(event) => importQuizFromNote(event.target.value)} value="" className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">Select a note to import</option>{recordsOf('note').map((item) => <option key={item.id} value={item.id}>{item.data.title || 'Untitled note'}</option>)}</select></label></div>
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Your quizzes</h2><p className="mb-4 mt-1 text-xs text-muted-foreground">Attempts are saved, with explanations and missed questions available for review.</p>{takingQuiz ? <div className="space-y-4">{quizResult ? <><div className="rounded-xl bg-primary/5 p-4"><div className="text-2xl font-bold">{quizResult.percent}%</div><p className="text-sm text-muted-foreground">{quizResult.correct} correct out of {quizResult.total}</p></div>{quizResult.results.map((result, index) => <article key={index} className={`rounded-xl border p-3 ${result.correct ? 'border-emerald-500/30' : 'border-destructive/30'}`}><div className="flex gap-2"><span className="font-semibold">{result.correct ? '✓' : 'Review'}</span><p className="text-sm font-medium">{result.prompt}</p></div><p className="mt-2 text-xs text-muted-foreground">Correct: {takingQuiz.data.questions[index]?.choices[result.answer]}</p>{result.explanation && <p className="mt-1 text-xs">{result.explanation}</p>}</article>)}{quizResult.results.some((result) => !result.correct) && <button type="button" onClick={createMissedQuestionsQuiz} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Practice missed questions</button>}<button type="button" onClick={() => { setTakingQuiz(null); setQuizResult(null); setQuizAnswers({}); }} className="rounded-lg border border-border px-4 py-2 text-sm">Back to quizzes</button></> : <><h3 className="text-lg font-semibold">{takingQuiz.data.title}</h3>{(takingQuiz.data.questions || []).map((question, index) => <fieldset key={index} className="rounded-xl border border-border p-4"><legend className="px-1 text-sm font-medium">{question.prompt}</legend><div className="space-y-2">{question.choices.map((choice, choiceIndex) => <label key={choiceIndex} className="flex items-center gap-2 text-sm"><input type="radio" name={`question-${index}`} checked={quizAnswers[index] === choiceIndex} onChange={() => setQuizAnswers((prev) => ({ ...prev, [index]: choiceIndex }))} />{choice}</label>)}</div></fieldset>)}<button type="button" onClick={submitQuiz} disabled={!takingQuiz.data.questions?.length} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Submit quiz</button></>}</div> : <div className="space-y-3">{quizzes.map((quiz) => { const quizAttempts = attempts.filter((item) => item.data.quiz_id === quiz.id); const latest = quizAttempts[0]; return <article key={quiz.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4"><div className="min-w-40 flex-1"><h3 className="font-medium">{quiz.data.title}</h3><p className="mt-1 text-xs text-muted-foreground">{quiz.data.questions?.length || 0} questions · {quizAttempts.length} attempts{latest ? ` · latest ${latest.data.percent}%` : ''}</p></div><button type="button" disabled={!quiz.data.questions?.length} onClick={() => { setTakingQuiz(quiz); setQuizAnswers({}); setQuizResult(null); }} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Take quiz</button></article>; })}{!quizzes.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Build a quiz or import structured questions from a note.</p>}</div>}
        </div>
      </section>}
      {busy && <div className="sr-only" role="status">Saving changes</div>}
    </main>
  );
}
