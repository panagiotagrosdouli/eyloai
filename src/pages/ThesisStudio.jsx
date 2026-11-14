import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getUsableSession } from '@/lib/supabaseClient';
import { loadThesisNoteSource } from '@/lib/thesis-note-source.mjs';
import ProjectDocumentWorkspace, { downloadWorkspace, workspaceButton as button, workspaceInput as input } from '@/components/projects/ProjectDocumentWorkspace';
import { assertThesisNotes, blankChapter, readThesis, THESIS_STATUSES, thesisComparison, thesisMarkdown, thesisProgress, validateThesis, whitespaceWordCount } from '@/lib/thesis-outline.mjs';
async function loadNotes(project, outline) {
  const session = await getUsableSession({ required: true, validate: true });
  const ownerId = session.user.id;
  const recent = await base44.entities.Note.list('-updated_date', 1000, ownerId);
  const currentNotes = Object.fromEntries(recent.filter(note => !note.project_id || note.project_id === project.id).map(note => [note.id, note]));
  const notes = { ...currentNotes };
  const linked = outline.chapters.filter(row => row.note_id);
  const exact = await Promise.allSettled(linked.map(chapter => loadThesisNoteSource({ repository: base44.entities.Note, chapter, projectId: project.id, ownerId })));
  exact.forEach((result, index) => {
    const id = linked[index].note_id; delete notes[id];
    if (result.status === 'fulfilled') { notes[id] = result.value.source; currentNotes[id] = result.value.current; }
  });
  return { notes, currentNotes };
}
async function checkThesisNotes(project, outline) {
  // Re-read exact canonical notes with owner-filtered SDK calls before every save.
  const extra = await loadNotes(project, outline); assertThesisNotes(outline, extra.notes, project.id); return extra;
}
const thesisPatch = (_project, outline) => ({ thesis_outline: validateThesis(outline) });
export default function ThesisStudio() {
  const { id } = useParams();
  return <ProjectDocumentWorkspace key={id} id={id} title="Thesis Studio" description="Build a chapter outline from your Notes, track word targets and compile a saved draft." read={readThesis} patch={thesisPatch} compare={thesisComparison} loadExtras={loadNotes} beforeSave={checkThesisNotes}>{state => <ThesisEditor {...state} />}</ProjectDocumentWorkspace>;
}
function ThesisEditor({ project, draft, setDraft, extras, setExtras, busy, setPendingDraft, setError, setNotice }) {
  const alive = useRef(true), [chapter, setChapter] = useState(null), [refreshing, setRefreshing] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setPendingDraft(Boolean(chapter)); return () => setPendingDraft(false); }, [chapter, setPendingDraft]);
  const notes = extras?.notes || {}, currentNotes = extras?.currentNotes || notes, progress = thesisProgress(draft, notes, project.id);
  const update = patch => setDraft(current => ({ ...current, ...patch }));
  const open = row => { if (!chapter || window.confirm('Discard the open chapter draft?')) setChapter(structuredClone(row)); };
  const apply = event => {
    event.preventDefault();
    try {
      const next = { ...draft, chapters: draft.chapters.some(row => row.id === chapter.id) ? draft.chapters.map(row => row.id === chapter.id ? chapter : row) : [...draft.chapters, chapter] };
      const source = chapter.note_version == null || currentNotes[chapter.note_id]?.version === chapter.note_version ? currentNotes[chapter.note_id] : notes[chapter.note_id];
      const nextNotes = chapter.note_id ? { ...notes, [chapter.note_id]: source } : notes;
      validateThesis(next); assertThesisNotes(next, nextNotes, project.id); setExtras({ ...extras, notes: nextNotes }); setDraft(next); setChapter(null); setError(''); setNotice('Chapter added to your draft. Save Thesis Studio to persist it.');
    } catch (failure) { setError(failure.message); }
  };
  const move = (index, offset) => {
    const next = [...draft.chapters], target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; update({ chapters: next });
  };
  const refresh = async () => {
    setRefreshing(true); setError('');
    try { const fresh = await loadNotes(project, draft); if (alive.current) { setExtras(fresh); setNotice('Saved Notes refreshed. Unsaved note-editor changes are not included.'); } }
    catch (failure) { if (alive.current) setError(failure.message); }
    finally { if (alive.current) setRefreshing(false); }
  };
  const exportSaved = async markdown => {
    setRefreshing(true); setError('');
    try {
      const saved = readThesis(project), fresh = await loadNotes(project, saved);
      assertThesisNotes(saved, fresh.notes, project.id);
      if (!alive.current) return;
      const linked = Object.fromEntries(saved.chapters.filter(row => row.note_id).map(row => [row.note_id, fresh.notes[row.note_id]]));
      const content = markdown ? thesisMarkdown(saved, linked, project.id) : JSON.stringify({ format: 'eylo-thesis-draft', version: 2, project_id: project.id, outline: saved, notes: Object.values(linked).map(({ id, title, content, version, updated_date, archived_date }) => ({ id, title, content, version, updated_date, archived_date })), disclosure: 'Private draft from canonical Notes. Pinned chapters use their exact retained version; unpinned chapters follow latest saved content. Archive time is not the original save time. No citation or academic acceptance verification.' }, null, 2);
      downloadWorkspace(content, `eylo-thesis-${project.id}.${markdown ? 'md' : 'json'}`, markdown ? 'text/markdown' : 'application/json');
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { if (alive.current) setRefreshing(false); }
  };
  return <div className="space-y-5">
    <label className="block text-sm">Thesis title<input className={input} disabled={busy} maxLength={200} value={draft.title} onChange={e => update({ title: e.target.value })} /></label>
    <section aria-label="Thesis progress" className="rounded-xl border border-border bg-card p-4 text-sm"><p>Saved-note words: <strong>{progress.words}</strong> · Target words: <strong>{progress.target}</strong></p><p>Complete chapters with saved content: {progress.complete} of {progress.chapters}</p><p className="mt-2 text-xs text-muted-foreground">Whitespace-based word counts; chapter statuses are user-reported. Unpinned chapters follow the latest saved Note. Pins use the exact version while available in the last 50 historical versions; deleted Notes or pruned history cannot be compiled. Refresh after saving in Notes. Select from your 1,000 most recent available Notes. Older Notes remain accessible through existing chapter links.</p>{progress.unavailable.length > 0 && <p role="alert" className="mt-2 text-destructive">A linked note is unavailable. Counts are incomplete; update links or refresh before saving/exporting.</p>}</section>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || refreshing || draft.chapters.length >= 50} onClick={() => open(blankChapter())}>Add chapter</button><button className={button} disabled={busy || refreshing} onClick={refresh}>Refresh saved Notes</button><button className={button} disabled={busy || refreshing} onClick={() => exportSaved(true)}>Compile saved thesis Markdown</button><button className={button} disabled={busy || refreshing} onClick={() => exportSaved(false)}>Export saved thesis JSON</button><Link className={button} to="/notes">Open Notes</Link></div>
    {refreshing && <p role="status">Reading saved Notes…</p>}
    {chapter && <form aria-label="Chapter editor" className="space-y-4 rounded-xl border border-border bg-card p-4" onSubmit={apply}><fieldset disabled={busy || refreshing} className="min-w-0 space-y-4"><legend className="mb-3 font-semibold">Chapter draft</legend><label className="block text-sm">Chapter title<input className={input} required maxLength={160} value={chapter.title} onChange={e => setChapter({ ...chapter, title: e.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Target words<input className={input} type="number" min={0} max={100000} step={1} required value={chapter.target_words} onChange={e => setChapter({ ...chapter, target_words: e.target.value === '' ? '' : Number(e.target.value) })} /></label><label className="block text-sm">Chapter status<select className={input} value={chapter.status} onChange={e => setChapter({ ...chapter, status: e.target.value })}>{THESIS_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label></div><label className="block text-sm">Linked saved Note<select className={input} value={chapter.note_id} onChange={e => setChapter({ ...chapter, note_id: e.target.value, note_version: null })}><option value="">No linked note</option>{chapter.note_id && !currentNotes[chapter.note_id] && <option value={chapter.note_id}>Linked note unavailable</option>}{Object.values(currentNotes).map(note => <option key={note.id} value={note.id}>{note.title || 'Untitled note'}</option>)}</select></label><div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={chapter.note_version != null} disabled={!Number.isInteger(currentNotes[chapter.note_id]?.version)} onChange={e => setChapter({ ...chapter, note_version: e.target.checked ? currentNotes[chapter.note_id].version : null })} />Pin to current saved Note version</label><p className="text-xs text-muted-foreground">{chapter.note_version == null ? 'Follows latest saved content until you pin a version.' : `Pinned version ${chapter.note_version}. Later Note edits will not replace this source.`}</p>{chapter.note_version != null && currentNotes[chapter.note_id]?.version !== chapter.note_version && Number.isInteger(currentNotes[chapter.note_id]?.version) && <button className={button} type="button" onClick={() => setChapter({ ...chapter, note_version: currentNotes[chapter.note_id].version })}>Use current saved Note version</button>}</div><label className="block text-sm">Chapter guidance<textarea className={input} maxLength={3000} rows={3} value={chapter.guidance} onChange={e => setChapter({ ...chapter, guidance: e.target.value })} /></label><div className="flex flex-wrap gap-2"><button className={button} type="submit">Apply chapter to draft</button><button className={button} type="button" onClick={() => { if (window.confirm('Discard the open chapter draft?')) setChapter(null); }}>Cancel chapter</button></div></fieldset></form>}
    <section aria-label="Ordered thesis chapters" className="space-y-3">{!draft.chapters.length && <p className="rounded-xl border border-dashed border-border p-5">No chapters yet.</p>}{draft.chapters.map((row, index) => <article key={row.id} className="space-y-3 rounded-xl border border-border bg-card p-4 [overflow-wrap:anywhere]"><h2 className="font-semibold">{index + 1}. {row.title}</h2><p className="text-sm">{row.status} · {row.note_version == null ? 'Latest saved Note' : `Pinned Note version ${row.note_version}`} · {row.note_id ? notes[row.note_id] ? `${whitespaceWordCount(notes[row.note_id].content)} saved-note words` : 'Linked note unavailable' : 'No note linked'} · target {row.target_words}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.guidance}</p>{notes[row.note_id] && <Link className="inline-flex min-h-11 items-center text-sm text-primary" to={`/notes?focus=${encodeURIComponent(row.note_id)}`}>Edit linked note: {notes[row.note_id].title}</Link>}<div className="flex flex-wrap gap-2"><button className={button} disabled={busy || refreshing} onClick={() => open(row)}>Edit chapter</button><button className={button} disabled={busy || index === 0 || Boolean(chapter)} onClick={() => move(index, -1)} aria-label={`Move ${row.title} up`}>Move up</button><button className={button} disabled={busy || index === draft.chapters.length - 1 || Boolean(chapter)} onClick={() => move(index, 1)} aria-label={`Move ${row.title} down`}>Move down</button><button className={button} disabled={busy || Boolean(chapter)} onClick={() => { if (window.confirm(`Remove “${row.title}” from the outline draft? The linked Note is kept.`)) update({ chapters: draft.chapters.filter(item => item.id !== row.id) }); }}>Remove chapter</button></div></article>)}</section>
  </div>;
}
