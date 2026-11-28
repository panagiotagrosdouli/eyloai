import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { durationSeconds, createTimeReport, exportTimeReportCsv, isTimeEntryPaused, transitionTimeEntry, exportTimeEntriesCsv, loadAllTimeEntries, normalizeManualTimeEntry, summarizeTimeEntries } from '@/lib/time-tracker-data.mjs';
import { Download, LoaderCircle, Play, Pause, Plus, Square, Timer, Trash2 } from 'lucide-react';

const timezoneNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const emptyForm = () => ({ description: '', project_id: '', life_task_id: '' });
const localInput = value => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const messageFor = error => error?.code === '23505'
  ? 'You already have a running timer. Stop it before starting another.'
  : error?.message || 'Time entry could not be saved. Please retry.';
const formatDuration = total => {
  const seconds = Math.max(0, Math.floor(total || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
};

export default function TimeTracker() {
  const timezone = timezoneNow();
  const { user } = useAuth();
  const ownerId = user?.id || null;
  const loadGeneration = useRef(0);
  const [entries, setEntries] = useState([]);
  const [visibleCount, setVisibleCount] = useState(50);
  const [historyOwner, setHistoryOwner] = useState(null);
  const historyReady = Boolean(ownerId) && historyOwner === ownerId;
  const [projects, setProjects] = useState([]);
  const [lifeItems, setLifeItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [manual, setManual] = useState({ description: '', project_id: '', life_task_id: '', started_at: localInput(new Date(Date.now() - 60 * 60_000)), ended_at: localInput(new Date()) });
  const [reportNow, setReportNow] = useState(Date.now);
  const [reportRange, setReportRange] = useState(() => ({ fromDate: localInput(new Date()).slice(0, 10), toDate: localInput(new Date()).slice(0, 10) }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true); setHistoryOwner(null); setEntries([]); setProjects([]); setLifeItems([]); setError(''); setSuccess('');
    if (!ownerId) { setLoading(false); return; }
    try {
      const session = await getUsableSession({ required: true, validate: true });
      if (session.user.id !== ownerId) throw new Error('Time data loading was canceled because your account changed.');
      const [rows, projectRows, lifeRows] = await Promise.all([
        loadAllTimeEntries(requireSupabase(), session.user.id),
        base44.entities.Project.list('-updated_date', 100),
        base44.entities.LifeTask.list('-updated_date', 500).then(data => ({ data, error: null })),
      ]);
      if (lifeRows.error) throw lifeRows.error;
      const current = await getUsableSession({ required: true, validate: true });
      if (generation !== loadGeneration.current || current.user.id !== ownerId) return;
      setEntries(rows); setVisibleCount(50); setHistoryOwner(ownerId); setProjects(projectRows || []); setLifeItems(lifeRows.data || []);
    } catch (loadError) { if (generation === loadGeneration.current) setError(messageFor(loadError)); }
    finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [ownerId]);
  useEffect(() => { load(); return () => { loadGeneration.current += 1; }; }, [load]);

  useEffect(() => {
    setForm(emptyForm());
    setManual({ description: '', project_id: '', life_task_id: '', started_at: localInput(new Date(Date.now() - 60 * 60_000)), ended_at: localInput(new Date()) });
  }, [ownerId]);

  const running = useMemo(() => entries.find(entry => entry.ended_at == null) || null, [entries]);
  useEffect(() => {
    const update = () => setReportNow(Date.now());
    update(); const timer = setInterval(update, running ? 1000 : 60_000);
    return () => clearInterval(timer);
  }, [running]);

  const supportsPauses = Array.isArray(running?.pause_intervals) && Number.isSafeInteger(running?.timer_revision);
  const runningSeconds = running ? durationSeconds(running, reportNow) : 0;
  const summary = useMemo(() => summarizeTimeEntries(entries, { now: new Date(reportNow), timezone }), [entries, reportNow, timezone]);

  const selectedReport = useMemo(() => {
    try { return { data: createTimeReport(entries, { ...reportRange, timezone, now: reportNow }), error: '' }; }
    catch (reportError) { return { data: null, error: reportError.message || 'Report could not be calculated.' }; }
  }, [entries, reportRange, timezone, reportNow]);

  const exportReport = () => {
    if (!historyReady || !selectedReport.data) return;
    const blob = new Blob([exportTimeReportCsv(selectedReport.data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `eylo-time-report-${reportRange.fromDate}-${reportRange.toDate}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const startTimer = async event => {
    event.preventDefault(); if (saving||!historyReady) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const description = form.description.trim();
      if (!description || description.length > 500) throw new Error('Describe what you are working on (1–500 characters).');
      const { data, error: insertError } = await requireSupabase().from('time_entries').insert({
        user_id: session.user.id, description, project_id: form.project_id || null,
        life_task_id: form.life_task_id || null, started_at: new Date().toISOString(), ended_at: null,
      }).select('*').single();
      if (insertError) throw insertError;
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Timer start canceled because your account changed.');
      setEntries(previous => [data, ...previous]); setForm(emptyForm()); setSuccess('Timer started.');
    } catch (startError) { setError(messageFor(startError)); }
    finally { setSaving(false); }
  };

  const changeTimer = async action => {
    if (!running || saving || !historyReady) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const data = await transitionTimeEntry(requireSupabase(), running, session.user.id, action);
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Timer update canceled because your account changed.');
      setEntries(previous => previous.map(entry => entry.id === data.id ? data : entry));
      setSuccess(action === 'stop' ? `Timer stopped after ${formatDuration(durationSeconds(data))}.` : action === 'pause' ? 'Timer paused. Paused time is excluded from your reports.' : 'Timer resumed.');
    } catch (stopError) { setError(messageFor(stopError)); }
    finally { setSaving(false); }
  };

  const addManualEntry = async event => {
    event.preventDefault(); if (saving||!historyReady) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const payload = normalizeManualTimeEntry({ ...manual, timezone });
      const { data, error: insertError } = await requireSupabase().from('time_entries').insert({ ...payload, user_id: session.user.id }).select('*').single();
      if (insertError) throw insertError;
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Manual entry save canceled because your account changed.');
      setEntries(previous => [data, ...previous].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)));
      setSuccess('Manual time entry saved.');
    } catch (insertError) { setError(messageFor(insertError)); }
    finally { setSaving(false); }
  };

  const deleteEntry = async entry => {
    if (!window.confirm(`Delete this time entry for “${entry.description}”?`)) return;
    setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: deleteError } = await requireSupabase().from('time_entries').delete()
        .eq('id', entry.id).eq('user_id', session.user.id).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Time entry not found or access denied.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Delete canceled because your account changed.');
      setEntries(previous => previous.filter(item => item.id !== entry.id)); setSuccess('Time entry deleted.');
    } catch (deleteError) { setError(messageFor(deleteError)); }
  };

  const exportCsv = async () => {
    if (exporting||!historyReady) return;
    setExporting(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const all = await loadAllTimeEntries(requireSupabase(), session.user.id);
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Export canceled because your account changed.');
      const blob = new Blob([exportTimeEntriesCsv(all)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'eylo-time-entries.csv'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) { setError(messageFor(exportError)); }
    finally { setExporting(false); }
  };

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8" aria-labelledby="time-title">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Productivity</p><h1 id="time-title" className="mt-1 text-3xl font-semibold">EYLO Time Tracker</h1><p className="mt-1 text-sm text-muted-foreground">Track real work time against projects and tasks, then report or export it.</p></div><button type="button" onClick={exportCsv} disabled={exporting||!historyReady} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm disabled:opacity-60">{exporting?<LoaderCircle size={15} className="animate-spin"/>:<Download size={15}/>}{exporting?'Preparing export…':'Export all CSV'}</button></header>
    {(error||success)&&<div role={error?'alert':'status'} className={`mb-4 rounded-xl border p-3 text-sm ${error?'border-destructive/40 bg-destructive/10':'border-primary/30 bg-primary/5'}`}>{error||success}{error&&<button onClick={load} className="ml-3 font-semibold underline">Reload</button>}</div>}
    {historyReady&&<section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Time reports"><Stat label="Today" value={formatDuration(summary.todaySeconds)}/><Stat label="This week" value={formatDuration(summary.weekSeconds)}/><Stat label="Total tracked" value={formatDuration(summary.totalSeconds)}/><Stat label="Recorded entries" value={entries.length}/></section>}
    {historyReady&&<section className="mb-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="report-title">
      <h2 id="report-title" className="text-lg font-semibold">Historical report</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Report from" id="report-from"><input id="report-from" type="date" value={reportRange.fromDate} onChange={event=>setReportRange({...reportRange,fromDate:event.target.value})} className="mt-1 min-h-11 max-w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field>
        <Field label="Report through" id="report-through"><input id="report-through" type="date" value={reportRange.toDate} onChange={event=>setReportRange({...reportRange,toDate:event.target.value})} className="mt-1 min-h-11 max-w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field>
        <button type="button" disabled={!selectedReport.data} onClick={exportReport} className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-60">Export report CSV</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Inclusive dates in {timezone}. Only work inside this range is counted; pauses are excluded.</p>
      {selectedReport.error?<p role="alert" className="mt-3 text-sm text-destructive">{selectedReport.error}</p>:<div className="mt-3" role="status"><p className="font-semibold">{formatDuration(selectedReport.data.totalSeconds)} across {selectedReport.data.rows.length} entries</p><ul className="mt-2 space-y-1">{selectedReport.data.byProject.map(group=><li key={group.project_id||'unassigned'} className="flex flex-wrap justify-between gap-2 text-sm"><span>{projects.find(project=>project.id===group.project_id)?.title||'Unassigned'}</span><span>{formatDuration(group.seconds)}</span></li>)}</ul></div>}
    </section>}
    {!historyReady&&<p role="status" className="py-8 text-sm text-muted-foreground">{loading?'Loading time records…':'Time history is unavailable. Reload before tracking or reporting.'}</p>}
    {historyReady&&<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="entries-title"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="entries-title" className="text-lg font-semibold">Recent time entries</h2><span className="text-xs text-muted-foreground">Showing {Math.min(visibleCount, entries.length)} of {entries.length} loaded entries</span></div>
        {loading?<p className="py-12 text-center text-sm text-muted-foreground">Loading time records…</p>:entries.length?<ul className="space-y-3">{entries.slice(0, visibleCount).map(entry=>{const project=projects.find(item=>item.id===entry.project_id);const task=lifeItems.find(item=>item.id===entry.life_task_id);const active=entry.ended_at==null;return <li key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{entry.description}</h3>{active&&<span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">{isTimeEntryPaused(entry)?'Paused':'Running'}</span>}</div><p className="mt-1 text-sm text-muted-foreground">{new Date(entry.started_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short',timeZone:timezone})}{entry.ended_at?` – ${new Date(entry.ended_at).toLocaleTimeString([], {timeStyle:'short',timeZone:timezone})}`:' – now'} · {formatDuration(active&&running?.id===entry.id?runningSeconds:durationSeconds(entry))}</p>{project&&<p className="mt-1 text-xs text-primary">Project: {project.title||'Untitled project'}</p>}{task&&<p className="mt-1 text-xs text-muted-foreground">Task: {task.title}</p>}</div><button type="button" disabled={active} onClick={()=>deleteEntry(entry)} aria-label={`Delete time entry ${entry.description}`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-40"><Trash2 size={15}/></button></li>})}</ul>:!historyReady?<p role="status">Time history is unavailable. Reload before tracking or reporting.</p>:<div className="rounded-xl border border-dashed border-border px-4 py-12 text-center"><Timer size={22} className="mx-auto text-muted-foreground"/><p className="mt-3 font-medium">No time recorded yet.</p><p className="mt-1 text-sm text-muted-foreground">Start a timer or enter a completed work session.</p></div>}
        {historyReady&&visibleCount<entries.length&&<button type="button" onClick={()=>setVisibleCount(count=>count+50)} className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm">Show more entries</button>}
      </section>
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-4 text-lg font-semibold">{running?(isTimeEntryPaused(running)?'Timer paused':'Timer running'):'Start a timer'}</h2>{running?<><p className="text-3xl font-semibold tabular-nums" aria-live="polite">{formatDuration(runningSeconds)}</p><p className="mt-2 break-words text-sm text-muted-foreground">{running.description}</p><button type="button" onClick={()=>changeTimer(isTimeEntryPaused(running)?'resume':'pause')} disabled={saving||!historyReady||!supportsPauses} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60">{isTimeEntryPaused(running)?<Play size={15}/>:<Pause size={15}/>} {isTimeEntryPaused(running)?'Resume timer':'Pause timer'}</button>{!supportsPauses&&<p className="mt-2 text-xs text-muted-foreground">Pausing is not available in this workspace yet. You can still stop your timer.</p>}<button type="button" onClick={()=>changeTimer('stop')} disabled={saving||!historyReady} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-60">{saving?<LoaderCircle size={16} className="animate-spin"/>:<Square size={15}/>}Stop timer</button></>:<form onSubmit={startTimer} className="space-y-4"><Field label="What are you working on?" id="timer-description"><input id="timer-description" required maxLength={500} value={form.description} onChange={event=>setForm({...form,description:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Write a paper, analyze survey data…"/></Field><Field label="Project" id="timer-project"><select id="timer-project" value={form.project_id} onChange={event=>setForm({...form,project_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title||'Untitled project'}</option>)}</select></Field><Field label="Life task" id="timer-task"><select id="timer-task" value={form.life_task_id} onChange={event=>setForm({...form,life_task_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No task</option>{lifeItems.filter(item=>item.status !== 'done').map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><button disabled={saving||!historyReady} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving?<LoaderCircle size={16} className="animate-spin"/>:<Play size={16}/>}Start timer</button></form>}</section>
        <details className="rounded-2xl border border-border bg-card p-4 sm:p-6"><summary className="cursor-pointer text-lg font-semibold">Add a manual time entry</summary><form onSubmit={addManualEntry} className="mt-4 space-y-4"><Field label="Description" id="manual-description"><input id="manual-description" required maxLength={500} value={manual.description} onChange={event=>setManual({...manual,description:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field><Field label="Start" id="manual-start"><input id="manual-start" required type="datetime-local" value={manual.started_at} onChange={event=>setManual({...manual,started_at:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field><Field label="End" id="manual-end"><input id="manual-end" required type="datetime-local" value={manual.ended_at} onChange={event=>setManual({...manual,ended_at:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field><Field label="Project" id="manual-project"><select id="manual-project" value={manual.project_id} onChange={event=>setManual({...manual,project_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title||'Untitled project'}</option>)}</select></Field><Field label="Life task" id="manual-task"><select id="manual-task" value={manual.life_task_id} onChange={event=>setManual({...manual,life_task_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No task</option>{lifeItems.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><p className="text-xs text-muted-foreground">Times use your device zone: {timezone}</p><button disabled={saving||!historyReady} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm disabled:opacity-60">{saving?<LoaderCircle size={15} className="animate-spin"/>:<Plus size={15}/>}Save manual entry</button></form></details>
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-3 font-semibold">Time by project</h2>{summary.byProject.length?<ul className="space-y-2">{summary.byProject.map(group=><li key={group.project_id||'unassigned'} className="flex justify-between gap-3 text-sm"><span className="truncate text-muted-foreground">{projects.find(project=>project.id===group.project_id)?.title||'Unassigned'}</span><span className="shrink-0 font-medium">{formatDuration(group.seconds)}</span></li>)}</ul>:<p className="text-sm text-muted-foreground">Project totals will appear after you record time.</p>}</section>
      </div>
    </div>}
  </main>;
}

function Stat({label,value}){return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>;}
function Field({label,id,children}){return <div><label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;}
