import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { durationSeconds, exportTimeEntriesCsv, loadAllTimeEntries, normalizeManualTimeEntry, summarizeTimeEntries } from '@/lib/time-tracker-data.mjs';
import { Download, LoaderCircle, Play, Plus, Square, Timer, Trash2 } from 'lucide-react';

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
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [lifeItems, setLifeItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [manual, setManual] = useState({ description: '', project_id: '', life_task_id: '', started_at: localInput(new Date(Date.now() - 60 * 60_000)), ended_at: localInput(new Date()) });
  const [runningSeconds, setRunningSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const [rows, projectRows, lifeRows] = await Promise.all([
        requireSupabase().from('time_entries').select('*').eq('user_id', session.user.id).order('started_at', { ascending: false }).limit(1000),
        base44.entities.Project.list('-updated_date', 100),
        base44.entities.LifeTask.list('-updated_date', 500).then(data => ({ data, error: null })),
      ]);
      if (rows.error) throw rows.error;
      if (lifeRows.error) throw lifeRows.error;
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Time data loading was canceled because your account changed.');
      setEntries(rows.data || []); setProjects(projectRows || []); setLifeItems(lifeRows.data || []);
    } catch (loadError) { setError(messageFor(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const running = useMemo(() => entries.find(entry => entry.ended_at == null) || null, [entries]);
  useEffect(() => {
    if (!running) { setRunningSeconds(0); return undefined; }
    const update = () => setRunningSeconds(durationSeconds(running));
    update(); const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const summary = useMemo(() => summarizeTimeEntries(entries, { now: new Date(), timezone }), [entries, runningSeconds, timezone]);

  const startTimer = async event => {
    event.preventDefault(); if (saving) return;
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

  const stopTimer = async () => {
    if (!running || saving) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const endedAt = new Date().toISOString();
      const { data, error: updateError } = await requireSupabase().from('time_entries').update({ ended_at: endedAt })
        .eq('id', running.id).eq('user_id', session.user.id).eq('started_at', running.started_at).is('ended_at', null).select('*').maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('Timer changed in another tab. Reload to see its latest state.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Timer stop canceled because your account changed.');
      setEntries(previous => previous.map(entry => entry.id === data.id ? data : entry));
      setSuccess(`Timer stopped after ${formatDuration(durationSeconds(data))}.`);
    } catch (stopError) { setError(messageFor(stopError)); }
    finally { setSaving(false); }
  };

  const addManualEntry = async event => {
    event.preventDefault(); if (saving) return;
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
    if (exporting) return;
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
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Productivity</p><h1 id="time-title" className="mt-1 text-3xl font-semibold">EYLO Time Tracker</h1><p className="mt-1 text-sm text-muted-foreground">Track real work time against projects and tasks, then report or export it.</p></div><button type="button" onClick={exportCsv} disabled={exporting} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm disabled:opacity-60">{exporting?<LoaderCircle size={15} className="animate-spin"/>:<Download size={15}/>}{exporting?'Preparing export…':'Export all CSV'}</button></header>
    {(error||success)&&<div role={error?'alert':'status'} className={`mb-4 rounded-xl border p-3 text-sm ${error?'border-destructive/40 bg-destructive/10':'border-primary/30 bg-primary/5'}`}>{error||success}{error&&<button onClick={load} className="ml-3 font-semibold underline">Reload</button>}</div>}
    <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Time reports"><Stat label="Today" value={formatDuration(summary.todaySeconds)}/><Stat label="This week" value={formatDuration(summary.weekSeconds)}/><Stat label="Recorded entries" value={entries.length}/></section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="entries-title"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="entries-title" className="text-lg font-semibold">Recent time entries</h2><span className="text-xs text-muted-foreground">Showing up to 1,000 recent entries</span></div>
        {loading?<p className="py-12 text-center text-sm text-muted-foreground">Loading time records…</p>:entries.length?<ul className="space-y-3">{entries.map(entry=>{const project=projects.find(item=>item.id===entry.project_id);const task=lifeItems.find(item=>item.id===entry.life_task_id);const active=entry.ended_at==null;return <li key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{entry.description}</h3>{active&&<span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">Running</span>}</div><p className="mt-1 text-sm text-muted-foreground">{new Date(entry.started_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short',timeZone:timezone})}{entry.ended_at?` – ${new Date(entry.ended_at).toLocaleTimeString([], {timeStyle:'short',timeZone:timezone})}`:' – now'} · {formatDuration(active&&running?.id===entry.id?runningSeconds:durationSeconds(entry))}</p>{project&&<p className="mt-1 text-xs text-primary">Project: {project.title||'Untitled project'}</p>}{task&&<p className="mt-1 text-xs text-muted-foreground">Task: {task.title}</p>}</div><button type="button" disabled={active} onClick={()=>deleteEntry(entry)} aria-label={`Delete time entry ${entry.description}`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-40"><Trash2 size={15}/></button></li>})}</ul>:<div className="rounded-xl border border-dashed border-border px-4 py-12 text-center"><Timer size={22} className="mx-auto text-muted-foreground"/><p className="mt-3 font-medium">No time recorded yet.</p><p className="mt-1 text-sm text-muted-foreground">Start a timer or enter a completed work session.</p></div>}
      </section>
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-4 text-lg font-semibold">{running?'Timer running':'Start a timer'}</h2>{running?<><p className="text-3xl font-semibold tabular-nums" aria-live="polite">{formatDuration(runningSeconds)}</p><p className="mt-2 break-words text-sm text-muted-foreground">{running.description}</p><button type="button" onClick={stopTimer} disabled={saving} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-60">{saving?<LoaderCircle size={16} className="animate-spin"/>:<Square size={15}/>}Stop timer</button></>:<form onSubmit={startTimer} className="space-y-4"><Field label="What are you working on?" id="timer-description"><input id="timer-description" required maxLength={500} value={form.description} onChange={event=>setForm({...form,description:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Write a paper, analyze survey data…"/></Field><Field label="Project" id="timer-project"><select id="timer-project" value={form.project_id} onChange={event=>setForm({...form,project_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title||'Untitled project'}</option>)}</select></Field><Field label="Life task" id="timer-task"><select id="timer-task" value={form.life_task_id} onChange={event=>setForm({...form,life_task_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No task</option>{lifeItems.filter(item=>item.status !== 'done').map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><button disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving?<LoaderCircle size={16} className="animate-spin"/>:<Play size={16}/>}Start timer</button></form>}</section>
        <details className="rounded-2xl border border-border bg-card p-4 sm:p-6"><summary className="cursor-pointer text-lg font-semibold">Add a manual time entry</summary><form onSubmit={addManualEntry} className="mt-4 space-y-4"><Field label="Description" id="manual-description"><input id="manual-description" required maxLength={500} value={manual.description} onChange={event=>setManual({...manual,description:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field><Field label="Start" id="manual-start"><input id="manual-start" required type="datetime-local" value={manual.started_at} onChange={event=>setManual({...manual,started_at:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field><Field label="End" id="manual-end"><input id="manual-end" required type="datetime-local" value={manual.ended_at} onChange={event=>setManual({...manual,ended_at:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/></Field><Field label="Project" id="manual-project"><select id="manual-project" value={manual.project_id} onChange={event=>setManual({...manual,project_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title||'Untitled project'}</option>)}</select></Field><Field label="Life task" id="manual-task"><select id="manual-task" value={manual.life_task_id} onChange={event=>setManual({...manual,life_task_id:event.target.value})} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No task</option>{lifeItems.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><p className="text-xs text-muted-foreground">Times use your device zone: {timezone}</p><button disabled={saving} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm disabled:opacity-60">{saving?<LoaderCircle size={15} className="animate-spin"/>:<Plus size={15}/>}Save manual entry</button></form></details>
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-3 font-semibold">Time by project</h2>{summary.byProject.length?<ul className="space-y-2">{summary.byProject.map(group=><li key={group.project_id||'unassigned'} className="flex justify-between gap-3 text-sm"><span className="truncate text-muted-foreground">{projects.find(project=>project.id===group.project_id)?.title||'Unassigned'}</span><span className="shrink-0 font-medium">{formatDuration(group.seconds)}</span></li>)}</ul>:<p className="text-sm text-muted-foreground">Project totals will appear after you record time.</p>}</section>
      </div>
    </div>
  </main>;
}

function Stat({label,value}){return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>;}
function Field({label,id,children}){return <div><label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;}
