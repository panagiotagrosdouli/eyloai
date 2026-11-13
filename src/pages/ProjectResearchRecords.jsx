import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createResearchRecord, exportResearchRecords, readResearchRecords, RESEARCH_WORKSPACES, researchRecordPatch } from '@/lib/research-records.mjs';

const input = 'w-full min-w-0 rounded-lg border border-border bg-background p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const button = 'min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50';
export default function ProjectResearchRecords() {
  const { id, workspace } = useParams();
  if (!RESEARCH_WORKSPACES[workspace]) return <main className="eylo-page"><h1>Research workspace unavailable</h1><Link to="/projects">Return to projects</Link></main>;
  return <Workspace key={`${id}/${workspace}`} id={id} kind={workspace} />;
}
function Workspace({ id, kind }) {
  const config = RESEARCH_WORKSPACES[kind];
  const alive = useRef(true);
  const [project, setProject] = useState(null);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const saved = await base44.entities.Project.get(id);
      if (saved?.id !== id) throw new Error('This project is unavailable.');
      const records = readResearchRecords(kind, saved);
      if (alive.current) { setProject(saved); setRows(records); }
    } catch (failure) { if (alive.current) { setProject(null); setRows([]); setError(failure?.message || 'Project could not be loaded.'); } }
    finally { if (alive.current) setLoading(false); }
  }, [id, kind]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);
  useEffect(() => {
    if (!draft) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft]);
  const discard = () => !draft || window.confirm('Discard the open research draft?');
  const open = record => { if (discard()) { setDraft(structuredClone(record)); setNotice(''); } };
  const write = async (record, remove = false) => {
    if (busy || loading || !project) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const patch = researchRecordPatch(kind, project, record, remove);
      const saved = await base44.entities.Project.updateIfUnchanged(id, patch, project.updated_date);
      const records = readResearchRecords(kind, saved);
      if (alive.current) { setProject(saved); setRows(records); setDraft(null); setNotice(remove ? 'Record deleted.' : 'Record saved to this project.'); }
    } catch (failure) {
      if (alive.current) setError(['ENTITY_CONFLICT', 'PROJECT_VERSION_CONFLICT'].includes(failure?.code) ? 'This project changed in another tab. Your draft is retained. Reload latest project, review the saved records and your draft, then save again.' : failure?.message || 'Save failed. Your draft is retained.');
    } finally { if (alive.current) setBusy(false); }
  };
  const download = () => {
    try {
      const blob = new Blob([JSON.stringify(exportResearchRecords(kind, project), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `eylo-${kind}-${id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.message); }
  };
  return <main className="eylo-page mx-auto max-w-5xl space-y-5">
    <Link to={`/projects/${id}`} onClick={event => { if (!discard()) event.preventDefault(); }} className="inline-flex min-h-11 items-center text-sm text-primary">Back to {project?.title || 'project'}</Link>
    <header><p className="text-xs uppercase tracking-wider text-primary">EYLO project workspace</p><h1 className="mt-2 text-2xl font-bold">{config.title}</h1><p className="mt-2 text-sm text-muted-foreground">{config.description}</p><p className="mt-2 text-xs text-muted-foreground">Private project records. Source links are supplied by you and are not independently verified. Do not store participant identifiers or sensitive participant data here.</p></header>
    {loading && <p role="status">Loading project records…</p>}
    {error && <div role="alert" className="rounded-xl border border-destructive p-4 text-sm">{error}</div>}
    {notice && <p role="status">{notice}</p>}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={!project || busy || loading || rows.length >= 100} onClick={() => open(createResearchRecord(kind))}>New {config.singular}</button>
      <button className={button} disabled={!project || busy || loading} onClick={download}>Export saved records</button>
      <button className={button} disabled={busy || loading} onClick={load}>Reload latest project</button>
    </div>
    {draft && <form aria-label={`Edit ${config.singular}`} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6" onSubmit={event => { event.preventDefault(); void write(draft); }}>
      <fieldset disabled={busy || loading} className="min-w-0 space-y-4">
        <legend className="mb-4 font-semibold">{rows.some(row => row.id === draft.id) ? 'Edit' : 'New'} {config.singular}</legend>
        <label className="block text-sm">Title<input className={input} required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">Record date<input type="date" required className={input} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
          <label className="block text-sm">Next deadline (optional)<input type="date" className={input} value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} /></label>
          <label className="block text-sm">Status<select className={input} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>{config.statuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        </div>
        {config.fields.map(([key, label, max, required]) => <label key={key} className="block text-sm">{label}<textarea className={input} rows={key === 'reference' || key === 'venue' ? 2 : 4} required={Boolean(required)} maxLength={Number(max)} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
        <label className="block text-sm">Source URL (optional)<input type="url" className={input} maxLength={1500} value={draft.source_url} onChange={e => setDraft({ ...draft, source_url: e.target.value })} placeholder="https://" /></label>
        <div className="flex flex-wrap gap-2"><button className={`${button} bg-primary text-primary-foreground`} type="submit">Save record</button><button className={button} type="button" onClick={() => { if (discard()) setDraft(null); }}>Cancel draft</button></div>
      </fieldset>
    </form>}
    {project && <section aria-label="Saved research records" className="space-y-3">
      <label className="block text-sm">Find saved records<input className={input} type="search" value={filter} onChange={e => setFilter(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">{rows.length} of 100 records used. Export includes saved records only; it is not an immutable audit trail.</p>
      {rows.length === 0 && <p className="rounded-xl border border-dashed border-border p-6">No records yet. Add your first {config.singular}.</p>}
      {rows.length > 0 && !rows.some(row => `${row.title} ${row.status}`.toLowerCase().includes(filter.toLowerCase())) && <p>No records match your search.</p>}
      {[...rows].filter(row => `${row.title} ${row.status}`.toLowerCase().includes(filter.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date)).map(row => <article key={row.id} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 [overflow-wrap:anywhere]">
        <h2 className="font-semibold">{row.title}</h2><p className="text-xs text-muted-foreground">{row.date} · {row.status.replaceAll('_', ' ')}{row.due_date ? ` · Next deadline: ${row.due_date}` : ''}</p>
        <dl className="space-y-3">{config.fields.filter(([key]) => row[key]).map(([key, label]) => <div key={key}><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap text-sm">{row[key]}</dd></div>)}</dl>
        {row.source_url && <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary">Open user-supplied source</a>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || loading} onClick={() => open(row)}>Edit {config.singular}</button><button className={button} disabled={busy || loading || Boolean(draft)} onClick={() => { if (window.confirm(`Permanently delete “${row.title}” from this project?`)) void write(row, true); }}>Delete {config.singular}</button></div>
      </article>)}
    </section>}
  </main>;
}
