import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export const workspaceInput = 'w-full min-w-0 rounded-lg border border-border bg-background p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
export const workspaceButton = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50';
export function downloadWorkspace(content, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Single project document: compare-and-set, retained local draft, explicit conflict choice. */
export default function ProjectDocumentWorkspace({ id, title, description, read, patch, compare, loadExtras, beforeSave, children }) {
  const alive = useRef(true);
  const [project, setProject] = useState(null), [draft, setDraft] = useState(null), [baseline, setBaseline] = useState('');
  const [extras, setExtras] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(true), [conflict, setConflict] = useState(false), [latest, setLatest] = useState(null), [pendingDraft, setPendingDraft] = useState(false);
  const dirty = Boolean(pendingDraft || (draft && JSON.stringify(draft) !== baseline));
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        const saved = await base44.entities.Project.get(id);
        if (saved?.id !== id) throw new Error('This private project is unavailable.');
        const doc = read(saved), extra = loadExtras ? await loadExtras(saved, doc) : null;
        if (alive.current) { setProject(saved); setDraft(structuredClone(doc)); setBaseline(JSON.stringify(doc)); setExtras(extra); }
      } catch (failure) { if (alive.current) setError(failure?.message || 'Workspace could not be loaded.'); }
      finally { if (alive.current) setBusy(false); }
    })();
    return () => { alive.current = false; };
  }, [id, read, loadExtras]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const save = async () => {
    if (busy || conflict || pendingDraft || !project || !draft) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const write = patch(project, draft);
      const freshExtras = beforeSave ? await beforeSave(project, draft, extras) : undefined;
      const saved = await base44.entities.Project.updateIfUnchanged(id, write, project.updated_date); const document = read(saved);
      if (alive.current) { setProject(saved); setDraft(structuredClone(document)); setBaseline(JSON.stringify(document)); if (freshExtras !== undefined) setExtras(freshExtras); setNotice(`${title} saved.`); }
    } catch (failure) {
      if (alive.current) {
        const stale = ['ENTITY_CONFLICT', 'PROJECT_VERSION_CONFLICT'].includes(failure?.code); setConflict(stale);
        setError(stale ? 'This project changed in another tab. Your draft is retained. Compare the latest save before choosing what to keep.' : failure?.message || 'Save failed. Your draft is retained.');
      }
    } finally { if (alive.current) setBusy(false); }
  };
  const compareLatest = async () => {
    setBusy(true); setError('');
    try { const saved = await base44.entities.Project.get(id); if (saved?.id !== id) throw new Error('This private project is unavailable.'); const doc = read(saved); if (alive.current) setLatest({ project: saved, doc }); }
    catch (failure) { if (alive.current) setError(failure?.message || 'Latest save could not be loaded.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const resolve = mine => {
    if (!latest || busy) return;
    if (!mine && dirty && !window.confirm('Discard your draft and use the saved version?')) return;
    setProject(latest.project); setBaseline(JSON.stringify(latest.doc));
    if (!mine) setDraft(structuredClone(latest.doc));
    setLatest(null); setConflict(false); setError(''); setNotice(mine ? 'Your draft is ready for review. Save explicitly to replace this workspace in the latest project.' : 'Saved version loaded.');
  };
  return <main className="eylo-page mx-auto max-w-5xl space-y-5">
    <Link className="inline-flex min-h-11 items-center text-sm text-primary" to={`/projects/${id}`} onClick={event => { if (dirty && !window.confirm('Discard unsaved workspace changes?')) event.preventDefault(); }}>Back to {project?.title || 'project'}</Link>
    <header><p className="text-xs uppercase tracking-wider text-primary">EYLO project workspace</p><h1 className="mt-2 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></header>
    {error && <p role="alert" className="rounded-xl border border-destructive p-4 text-sm">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {busy && <p role="status">Loading or saving workspace…</p>}
    {draft && <>
      <div className="flex flex-wrap items-center gap-3"><button className={`${workspaceButton} bg-primary text-primary-foreground`} disabled={busy || conflict || pendingDraft || !dirty} onClick={save}>Save {title}</button><span className="text-xs text-muted-foreground">{pendingDraft ? 'Apply or cancel the open editor before saving' : dirty ? 'Unsaved changes' : 'Saved version'} · Explicit save</span></div>
      {conflict && <button className={workspaceButton} disabled={busy} onClick={compareLatest}>Compare latest save</button>}
      {latest && <section aria-label="Workspace conflict comparison" className="space-y-3 rounded-xl border border-border p-4"><h2 className="font-semibold">Review both versions</h2><div className="grid gap-4 sm:grid-cols-2">{[['Your draft', draft], ['Latest saved version', latest.doc]].map(([label, doc]) => <div key={String(label)}><h3 className="text-sm font-semibold">{String(label)}</h3><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary p-3 text-xs">{compare(doc)}</pre></div>)}</div><div className="flex flex-wrap gap-2"><button className={workspaceButton} disabled={busy} onClick={() => resolve(true)}>Keep my draft for review</button><button className={workspaceButton} disabled={busy} onClick={() => resolve(false)}>Use saved version</button></div></section>}
      {children({ project, draft, setDraft, extras, setExtras, busy: busy || conflict, setPendingDraft, setError, setNotice })}
    </>}
    {!busy && !project && <button className={workspaceButton} onClick={() => window.location.reload()}>Retry workspace</button>}
  </main>;
}
