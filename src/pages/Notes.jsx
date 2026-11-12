import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Archive, Check, Clock3, Download, FilePlus2, LoaderCircle, Search, Trash2 } from 'lucide-react';
import { requireSupabase, getUsableSession } from '@/lib/supabaseClient';
import { exportNoteMarkdown, filterNotes, normalizeNoteInput } from '@/lib/notes-data.mjs';

const EMPTY = { title: 'Untitled note', content: '', notebook: 'Personal', tags: [] };
const messageFor = error => error?.code === 'PGRST116'
  ? 'This note changed elsewhere. Reload it before editing again.'
  : error?.message || 'The request could not be completed. Please retry.';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [versions, setVersions] = useState([]);
  const [query, setQuery] = useState('');
  const [notebookFilter, setNotebookFilter] = useState('All notebooks');
  const [tagText, setTagText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const original = useRef(null);
  const timer = useRef(null);

  const loadNotes = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: readError } = await requireSupabase().from('notes').select('*')
        .eq('user_id', session.user.id).order('updated_at', { ascending: false });
      if (readError) throw readError;
      setNotes(data || []);
      setSelected(current => (current && data?.some(note => note.id === current.id)
        ? data.find(note => note.id === current.id) : data?.[0] || null));
    } catch (loadError) { setError(messageFor(loadError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes, reloadToken]);
  useEffect(() => {
    if (!selected) { original.current = null; setTagText(''); return; }
    original.current = JSON.stringify([selected.title, selected.content, selected.notebook, selected.tags || []]);
    setTagText((selected.tags || []).join(', '));
    setError('');
  }, [selected?.id]);

  const visibleNotes = useMemo(() => filterNotes(notes, query, notebookFilter), [notes, query, notebookFilter]);
  const notebooks = useMemo(() => ['All notebooks', ...new Set(notes.map(note => note.notebook).filter(Boolean))], [notes]);

  const save = useCallback(async draft => {
    if (!draft?.id || saving) return;
    let payload;
    try { payload = normalizeNoteInput(draft); }
    catch (validationError) { setError(validationError.message); return; }
    const value = JSON.stringify([payload.title, payload.content, payload.notebook, payload.tags]);
    if (value === original.current) return;
    setSaving(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: writeError } = await requireSupabase().from('notes').update(payload)
        .eq('id', draft.id).eq('user_id', session.user.id).eq('updated_at', draft.updated_at)
        .select('*').maybeSingle();
      if (writeError) throw writeError;
      if (!data) throw Object.assign(new Error('This note was updated in another session. Reload to see the latest version.'), { code: 'CONCURRENT_NOTE_EDIT' });
      original.current = JSON.stringify([data.title, data.content, data.notebook, data.tags || []]);
      setNotes(previous => [data, ...previous.filter(note => note.id !== data.id)]);
      setSelected(data); setSavedAt(new Date(data.updated_at));
    } catch (writeError) { setError(messageFor(writeError)); }
    finally { setSaving(false); }
  }, [saving]);

  useEffect(() => {
    if (!selected?.id) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(selected), 700);
    return () => clearTimeout(timer.current);
  }, [selected, save]);

  const createNote = async () => {
    setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: createError } = await requireSupabase().from('notes')
        .insert({ ...EMPTY, user_id: session.user.id }).select('*').single();
      if (createError) throw createError;
      setNotes(previous => [data, ...previous]); setSelected(data);
    } catch (createError) { setError(messageFor(createError)); }
  };

  const deleteNote = async () => {
    if (!selected || !window.confirm(`Delete “${selected.title}”? This also removes its saved versions.`)) return;
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: deleteError } = await requireSupabase().from('notes').delete()
        .eq('id', selected.id).eq('user_id', session.user.id).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Note not found or access denied.');
      const remaining = notes.filter(note => note.id !== selected.id);
      setNotes(remaining); setSelected(remaining[0] || null); setVersions([]);
    } catch (deleteError) { setError(messageFor(deleteError)); }
  };

  const showVersions = async () => {
    if (!selected) return;
    setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: versionError } = await requireSupabase().from('note_versions').select('*')
        .eq('note_id', selected.id).eq('user_id', session.user.id).order('saved_at', { ascending: false }).limit(50);
      if (versionError) throw versionError;
      setVersions(data || []);
    } catch (versionError) { setError(messageFor(versionError)); }
  };

  const exportCurrentNote = () => {
    if (!selected) return;
    const blob = new Blob([exportNoteMarkdown(selected)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(selected.title || 'note').replace(/[^\p{L}\p{N}._ -]/gu, '').trim().replace(/\s+/g, '-') || 'note'}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const patchSelected = patch => setSelected(current => current ? { ...current, ...patch } : current);
  const changeTags = value => {
    setTagText(value);
    patchSelected({ tags: value.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean).slice(0, 20) });
  };

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8" aria-labelledby="notes-title">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Workspace</p><h1 id="notes-title" className="mt-1 text-3xl font-semibold">EYLO Notes</h1><p className="mt-1 text-sm text-muted-foreground">Your private notes, saved to your account with version history.</p></div>
      <button type="button" onClick={createNote} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><FilePlus2 size={17} />New note</button>
    </header>
    {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"><span>{error}</span><button onClick={() => setReloadToken(value => value + 1)} className="font-semibold underline">Reload</button></div>}
    <div className="grid min-h-[68vh] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-border p-3 lg:border-b-0 lg:border-r" aria-label="Notes list">
        <label className="mb-3 flex h-10 items-center gap-2 rounded-lg border border-border px-3"><Search size={16} aria-hidden="true"/><input aria-label="Search notes" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search notes" /></label>
        <label className="sr-only" htmlFor="notebook-filter">Filter by notebook</label><select id="notebook-filter" value={notebookFilter} onChange={event => setNotebookFilter(event.target.value)} className="mb-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">{notebooks.map(book => <option key={book}>{book}</option>)}</select>
        {loading ? <p className="p-3 text-sm text-muted-foreground">Loading notes…</p> : visibleNotes.length ? <ul className="max-h-[55vh] space-y-1 overflow-auto">{visibleNotes.map(note => <li key={note.id}><button onClick={() => { setVersions([]); setSelected(note); }} aria-current={selected?.id === note.id ? 'true' : undefined} className={`w-full rounded-xl p-3 text-left ${selected?.id === note.id ? 'bg-primary/10' : 'hover:bg-muted'}`}><span className="block truncate text-sm font-semibold">{note.title || 'Untitled note'}</span><span className="mt-1 block text-xs text-muted-foreground">{note.notebook} · {new Date(note.updated_at).toLocaleDateString()}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{note.content || 'No content'}</span></button></li>)}</ul> : <p className="p-3 text-sm text-muted-foreground">No matching notes. Create one to get started.</p>}
      </aside>
      <section className="min-w-0 p-4 sm:p-6" aria-label="Note editor">
        {selected ? <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">{saving ? <><LoaderCircle size={14} className="animate-spin"/>Saving…</> : savedAt ? <><Check size={14}/>Saved {savedAt.toLocaleTimeString()}</> : <><Check size={14}/>Autosave on</>}</div>
            <div className="flex gap-2"><button type="button" onClick={exportCurrentNote} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"><Download size={15}/>Export</button><button type="button" onClick={showVersions} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"><Clock3 size={15}/>History</button><button type="button" onClick={deleteNote} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-destructive"><Trash2 size={15}/>Delete</button></div>
          </div>
          <label className="sr-only" htmlFor="note-title">Title</label><input id="note-title" maxLength={200} value={selected.title} onChange={event => patchSelected({ title: event.target.value })} className="mb-3 w-full border-0 bg-transparent text-2xl font-semibold outline-none" placeholder="Note title" />
          <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Notebook<input maxLength={100} value={selected.notebook} onChange={event => patchSelected({ notebook: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">Tags, separated by commas<input value={tagText} onChange={event => changeTags(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" placeholder="e.g. thesis, methods" /></label></div>
          <div className="mb-2 flex justify-end"><button onClick={() => setPreview(value => !value)} className="rounded-lg px-3 py-1.5 text-sm text-primary">{preview ? 'Edit' : 'Preview'}</button></div>
          {preview ? <article className="prose prose-sm min-h-[38vh] max-w-none rounded-xl border border-border p-4 dark:prose-invert"><ReactMarkdown>{selected.content || '*No content yet.*'}</ReactMarkdown></article> : <><label className="sr-only" htmlFor="note-content">Note content, Markdown supported</label><textarea id="note-content" maxLength={200000} value={selected.content} onChange={event => patchSelected({ content: event.target.value })} className="min-h-[38vh] w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-primary" placeholder="Write your note… Markdown is supported." /><p className="mt-2 text-xs text-muted-foreground">Markdown supported · {selected.content.length.toLocaleString()} / 200,000 characters</p></>}
          {versions.length > 0 && <section className="mt-6 rounded-xl border border-border p-4"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Archive size={16}/>Previous versions</h2><ul className="space-y-2">{versions.map(version => <li key={version.id} className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{new Date(version.saved_at).toLocaleString()}</div><div className="mt-1 font-medium">{version.title}</div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{version.content}</p></li>)}</ul></section>}
        </> : <div className="grid min-h-[50vh] place-items-center text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'Select a note or create a new one.'}</div>}
      </section>
    </div>
  </main>;
}
