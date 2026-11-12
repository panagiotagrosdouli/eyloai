import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FilePlus2, History, Link2, Save, Search, Tag, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { normalizeNote, noteMatchesTag, noteToMarkdown } from '@/lib/notes-domain.mjs';
import { useAuth } from '@/lib/AuthContext';

const EMPTY_NOTE = { title: '', content: '', tags: [], project_id: '' };

function editorValue(note) {
  return {
    title: note?.title || '',
    content: note?.content || '',
    tags: Array.isArray(note?.tags) ? note.tags : [],
    project_id: note?.project_id || '',
  };
}

function sameNote(left, right) {
  return JSON.stringify(editorValue(left)) === JSON.stringify(editorValue(right));
}

function safeFilename(value) {
  const name = String(value || 'note').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  return `${name || 'note'}.md`;
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

export default function Notes() {
  const { user } = useAuth();
  const ownerRef = useRef(user?.id || null);
  const [notes, setNotes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(EMPTY_NOTE);
  const [baseline, setBaseline] = useState(EMPTY_NOTE);
  const [versions, setVersions] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [versionError, setVersionError] = useState('');
  const dirty = !sameNote(editor, baseline) || tagInput.trim() !== baseline.tags.join(', ');

  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const availableTags = useMemo(() => [...new Set(notes.flatMap(note => Array.isArray(note.tags) ? note.tags : []))].sort((a, b) => a.localeCompare(b)), [notes]);
  const visibleNotes = useMemo(() => notes.filter(note => noteMatchesTag(note, activeTag)), [notes, activeTag]);

  const loadWorkspace = async (ownerId = ownerRef.current) => {
    if (!ownerId || ownerId !== ownerRef.current) return;
    setLoading(true);
    setError('');
    const [noteResult, projectResult] = await Promise.allSettled([
      base44.entities.Note.list('-updated_date', 1000),
      base44.entities.Project.list('-updated_date', 1000),
    ]);
    if (ownerId !== ownerRef.current) return;
    if (noteResult.status === 'fulfilled') setNotes(noteResult.value);
    else setError('Your notes could not be loaded. Check your connection and retry.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    else setNotice('Projects could not be loaded. You can still create and edit notes without a project link.');
    setLoading(false);
  };

  useEffect(() => {
    ownerRef.current = user?.id || null;
    setNotes([]);
    setProjects([]);
    setSelected(null);
    setEditor(EMPTY_NOTE);
    setBaseline(EMPTY_NOTE);
    setVersions([]);
    setTagInput('');
    setSearchInput('');
    setActiveSearch('');
    setActiveTag('');
    setError('');
    setNotice('');
    setVersionError('');
    if (user?.id) void loadWorkspace(user.id);
    else setLoading(false);
  }, [user?.id]);

  const loadVersions = async (noteId, ownerId = ownerRef.current) => {
    setVersionError('');
    try {
      const result = await base44.entities.Note.versions(noteId);
      if (ownerId === ownerRef.current) setVersions(result);
    } catch {
      if (ownerId === ownerRef.current) {
        setVersions([]);
        setVersionError('Version history is unavailable. Your current note remains editable.');
      }
    }
  };

  const chooseNote = async (note) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const next = editorValue(note);
    setSelected(note);
    setEditor(next);
    setBaseline(next);
    setTagInput(next.tags.join(', '));
    setNotice('');
    setVersions([]);
    if (note) await loadVersions(note.id);
  };

  const createDraft = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setSelected(null);
    setEditor(EMPTY_NOTE);
    setBaseline(EMPTY_NOTE);
    setTagInput('');
    setVersions([]);
    setVersionError('');
    setError('');
    setNotice('New note draft. Save it to keep it in your workspace.');
  };

  const runSearch = async (event) => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    const query = searchInput.trim();
    setError('');
    setLoading(true);
    try {
      const results = query
        ? await base44.entities.Note.search(query, 100)
        : await base44.entities.Note.list('-updated_date', 1000);
      if (ownerId !== ownerRef.current) return;
      setNotes(results);
      setActiveSearch(query);
      setActiveTag('');
    } catch (searchError) {
      if (ownerId === ownerRef.current) setError(searchError?.message || 'Search could not be completed. Retry in a moment.');
    } finally {
      if (ownerId === ownerRef.current) setLoading(false);
    }
  };

  const saveNote = async (event) => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = normalizeNote({ ...editor, tags: tagInput });
      const project = payload.project_id ? projectById.get(payload.project_id) : null;
      if (payload.project_id && !project) throw new Error('Select a project you own or remove the project link.');
      const savePayload = { ...payload, project_title: project?.title || '' };
      const saved = selected
        ? await base44.entities.Note.updateIfUnchanged(selected.id, savePayload, selected.updated_date)
        : await base44.entities.Note.create(savePayload);
      if (ownerId !== ownerRef.current) return;
      setSelected(saved);
      setEditor(editorValue(saved));
      setBaseline(editorValue(saved));
      setTagInput((saved.tags || []).join(', '));
      setNotes(current => [saved, ...current.filter(note => note.id !== saved.id)].sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date))));
      setNotice('Saved. Version history updates when note content changes.');
      if (selected) await loadVersions(saved.id, ownerId);
    } catch (saveError) {
      if (ownerId !== ownerRef.current) return;
      const message = saveError?.code === 'ENTITY_CONFLICT'
        ? 'This note changed in another tab. Reload the latest version before saving.'
        : saveError?.message || 'The note could not be saved. Your draft is still here.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async () => {
    if (!selected || !window.confirm('Delete this note and its version history?')) return;
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    setError('');
    try {
      await base44.entities.Note.delete(selected.id);
      if (ownerId !== ownerRef.current) return;
      setNotes(current => current.filter(note => note.id !== selected.id));
      setSelected(null);
      setEditor(EMPTY_NOTE);
      setBaseline(EMPTY_NOTE);
      setVersions([]);
      setNotice('Note deleted.');
    } catch (deleteError) {
      if (ownerId === ownerRef.current) setError(deleteError?.message || 'The note could not be deleted. Retry in a moment.');
    }
  };

  const exportNote = () => {
    const project = projectById.get(editor.project_id);
    const markdown = noteToMarkdown({ ...editor, project_title: project?.title || selected?.project_title, updated_date: selected?.updated_date });
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFilename(editor.title);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const restoreVersion = (version) => {
    if (dirty && !window.confirm('Replace the current draft with this saved version?')) return;
    const snapshot = version.snapshot || {};
    const next = editorValue(snapshot);
    setEditor(next);
    setTagInput(next.tags.join(', '));
    setNotice(`Version ${version.version} loaded as a draft. Save to restore it as the current note.`);
  };

  return (
    <div className="eylo-page max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eylo-eyebrow">Personal workspace</p>
          <h1 className="eylo-page-heading">Notes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Private notes with project links, tags, full-text search and recoverable versions.</p>
        </div>
        <button type="button" onClick={createDraft} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <FilePlus2 size={16} aria-hidden="true" /> New note
        </button>
      </header>

      <form onSubmit={runSearch} className="mb-5 flex max-w-2xl gap-2">
        <label htmlFor="note-search" className="sr-only">Search notes</label>
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input id="note-search" value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={200} placeholder="Search note titles and content…" className="min-h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <button type="submit" className="min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-secondary">Search</button>
      </form>

      {activeSearch && <p className="mb-3 text-xs text-muted-foreground">Full-text results for “{activeSearch}” · <button type="button" onClick={() => { setSearchInput(''); setActiveSearch(''); void runSearch({ preventDefault() {} }); }} className="underline">Clear search</button></p>}
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void loadWorkspace()} className="font-semibold underline">Retry</button></div>}
      {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-border bg-card p-3" aria-label="Your notes">
          <div className="flex items-center justify-between px-2 pb-3">
            <h2 className="text-sm font-semibold">Your notes</h2>
            <span className="text-xs text-muted-foreground">{visibleNotes.length}</span>
          </div>
          {availableTags.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border px-2 pb-3">
            <button type="button" onClick={() => setActiveTag('')} aria-pressed={!activeTag} className={`rounded-full border px-2 py-1 text-[11px] ${!activeTag ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>All tags</button>
            {availableTags.map(tag => <button type="button" key={tag} onClick={() => setActiveTag(activeTag === tag ? '' : tag)} aria-pressed={activeTag === tag} className={`rounded-full border px-2 py-1 text-[11px] ${activeTag === tag ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{tag}</button>)}
          </div>}
          {loading ? <p role="status" className="px-2 py-5 text-sm text-muted-foreground">Loading notes…</p>
            : visibleNotes.length ? <ul className="space-y-1">{visibleNotes.map(note => <li key={note.id}>
              <button type="button" onClick={() => void chooseNote(note)} aria-current={selected?.id === note.id ? 'page' : undefined} className={`w-full rounded-lg px-3 py-2.5 text-left ${selected?.id === note.id ? 'bg-secondary' : 'hover:bg-secondary/60'}`}>
                <span className="block truncate text-sm font-medium">{note.title || 'Untitled note'}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{note.content || 'No content yet'}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{displayDate(note.updated_date)}</span>
              </button>
            </li>)}</ul>
              : <p className="px-2 py-5 text-sm text-muted-foreground">{activeSearch ? 'No notes matched this search.' : activeTag ? 'No notes use this tag.' : 'Your saved notes will appear here.'}</p>}
        </aside>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label="Note editor">
          <form onSubmit={saveNote}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{selected ? `Version ${selected.version || 1}` : 'Unsaved note'}{dirty ? ' · Unsaved changes' : ''}</span>
              <div className="flex flex-wrap gap-2">
                {selected && <button type="button" onClick={exportNote} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-secondary"><Download size={14} aria-hidden="true" /> Export Markdown</button>}
                {selected && <button type="button" onClick={() => void deleteNote()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs text-destructive hover:bg-destructive/5"><Trash2 size={14} aria-hidden="true" /> Delete</button>}
                <button type="submit" disabled={saving || (!dirty && Boolean(selected))} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Save size={14} aria-hidden="true" />{saving ? 'Saving…' : 'Save note'}</button>
              </div>
            </div>
            <label htmlFor="note-title" className="sr-only">Note title</label>
            <input id="note-title" required maxLength={200} value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} placeholder="Untitled note" className="mb-3 min-h-12 w-full border-0 bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/60" />
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-muted-foreground"><span className="mb-1.5 flex items-center gap-1.5"><Tag size={13} aria-hidden="true" /> Tags, comma separated</span>
                <input value={tagInput} onChange={event => setTagInput(event.target.value)} maxLength={1300} placeholder="methods, grant, reading" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
              </label>
              <label className="block text-xs font-medium text-muted-foreground"><span className="mb-1.5 flex items-center gap-1.5"><Link2 size={13} aria-hidden="true" /> Link to a project</span>
                <select value={editor.project_id} onChange={event => setEditor(current => ({ ...current, project_id: event.target.value }))} className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                  <option value="">No project</option>
                  {projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}
                </select>
              </label>
            </div>
            <label htmlFor="note-content" className="sr-only">Note content</label>
            <textarea id="note-content" maxLength={100000} rows={18} value={editor.content} onChange={event => setEditor(current => ({ ...current, content: event.target.value }))} placeholder="Write your note…" className="min-h-[48vh] w-full resize-y rounded-lg border border-border bg-background p-4 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Private to your account · Saved notes are versioned</span><span>{editor.content.length.toLocaleString()} / 100,000</span></div>
          </form>

          {selected && <section className="mt-7 border-t border-border pt-5" aria-labelledby="note-history-heading">
            <h2 id="note-history-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold"><History size={15} aria-hidden="true" /> Version history</h2>
            {versionError && <p role="status" className="mb-3 text-xs text-muted-foreground">{versionError}</p>}
            {!versionError && versions.length === 0 ? <p className="text-xs text-muted-foreground">Older versions appear here after the note changes.</p> : <ul className="space-y-2">{versions.map(version => <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">Version {version.version} · {displayDate(version.created_date)}</span>
              <button type="button" onClick={() => restoreVersion(version)} className="text-xs font-medium text-primary underline">Load as draft</button>
            </li>)}</ul>}
          </section>}
        </section>
      </div>
    </div>
  );
}
