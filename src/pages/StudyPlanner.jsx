import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, Plus, RotateCcw } from 'lucide-react';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { normalizeCalendarEvent, toDatetimeLocal } from '@/lib/calendar-data.mjs';

const futureDate = () => toDatetimeLocal(new Date(Date.now() + 60 * 60_000).toISOString());
const blank = () => ({ subject: '', title: '', description: '', starts_at: futureDate(), reminder_minutes: '30', project_id: '' });
const errorMessage = error => error?.message || 'Study plan could not be updated. Please retry.';

export default function StudyPlanner() {
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const [rows, projectRows] = await Promise.all([
        requireSupabase().from('calendar_events').select('*').eq('user_id', session.user.id)
          .in('event_type', ['study', 'exam']).order('starts_at', { ascending: true }).limit(500),
        base44.entities.Project.list('-updated_date', 100),
      ]);
      if (rows.error) throw rows.error;
      const active = await getUsableSession({ required: true, validate: true });
      if (session.user.id !== active.user.id) throw new Error('Study plan loading was canceled because your account changed.');
      setSessions(rows.data || []); setProjects(projectRows || []);
    } catch (loadError) { setError(errorMessage(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    all: sessions.length,
    completed: sessions.filter(item => item.status === 'completed').length,
    upcoming: sessions.filter(item => item.status !== 'completed' && Date.parse(item.starts_at) >= Date.now()).length,
  }), [sessions]);

  const addSession = async event => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const payload = normalizeCalendarEvent({
        ...form,
        title: form.title.trim() || `${form.subject.trim()} study session`,
        subject: form.subject,
        event_type: 'study',
        status: 'scheduled',
        recurrence: 'none',
        timezone,
      });
      const { data, error: writeError } = await requireSupabase().from('calendar_events')
        .insert({ ...payload, user_id: session.user.id }).select('*').single();
      if (writeError) throw writeError;
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Save canceled because your account changed.');
      setSessions(previous => [...previous, data].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)));
      setSuccess('Study session saved to the planner and your Calendar.'); setForm(blank());
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setSaving(false); }
  };

  const toggleComplete = async item => {
    if (pendingId) return;
    setPendingId(item.id); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const nextStatus = item.status === 'completed' ? 'scheduled' : 'completed';
      const { data, error: writeError } = await requireSupabase().from('calendar_events')
        .update({ status: nextStatus }).eq('id', item.id).eq('user_id', session.user.id)
        .eq('updated_at', item.updated_at).select('*').maybeSingle();
      if (writeError) throw writeError;
      if (!data) throw new Error('This session changed elsewhere. Reload and try again.');
      setSessions(previous => previous.map(row => row.id === data.id ? data : row));
      setSuccess(nextStatus === 'completed' ? 'Study session marked complete.' : 'Study session moved back to planned.');
    } catch (writeError) { setError(errorMessage(writeError)); }
    finally { setPendingId(null); }
  };

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8" aria-labelledby="study-planner-title">
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Education</p><h1 id="study-planner-title" className="mt-1 text-3xl font-semibold">EYLO Study Planner</h1><p className="mt-1 text-sm text-muted-foreground">Schedule focused study sessions, associate them with projects, and track completion. Sessions also appear in Calendar.</p></header>
    {(error || success) && <div role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl border p-3 text-sm ${error ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/5'}`}>{error || success}{error && <button onClick={load} className="ml-3 font-semibold underline">Reload</button>}</div>}
    <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Study progress"><Stat label="Planned and past sessions" value={stats.all}/><Stat label="Completed" value={stats.completed}/><Stat label="Upcoming" value={stats.upcoming}/></section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="sessions-title"><h2 id="sessions-title" className="mb-4 text-lg font-semibold">Study sessions and exams</h2>
        {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading study plan…</p> : sessions.length ? <ul className="space-y-3">{sessions.map(item => <li key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-border p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">{item.event_type === 'exam' ? 'Exam' : 'Study session'}</span>{item.status === 'completed' && <span className="text-xs font-medium text-green-600">Completed</span>}</div><h3 className="mt-2 break-words font-semibold">{item.title}</h3>{item.subject && <p className="mt-1 text-sm text-primary">{item.subject}</p>}<p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays size={14}/>{new Date(item.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone })} · {item.timezone}</p>{item.project_id && <p className="mt-1 text-xs text-muted-foreground">Project: {projects.find(project => project.id === item.project_id)?.title || 'Linked project'}</p>}</div><button type="button" onClick={() => toggleComplete(item)} disabled={pendingId === item.id} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border px-3 text-sm disabled:opacity-60" aria-label={`${item.status === 'completed' ? 'Reopen' : 'Complete'} ${item.title}`}>{pendingId === item.id ? <LoaderCircle size={15} className="animate-spin"/> : item.status === 'completed' ? <RotateCcw size={15}/> : <CheckCircle2 size={15} />}{item.status === 'completed' ? 'Reopen' : 'Complete'}</button></li>)}</ul> : <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center"><Clock3 size={22} className="mx-auto text-muted-foreground"/><p className="mt-3 font-medium">No study sessions yet.</p><p className="mt-1 text-sm text-muted-foreground">Create your first session. It will be saved to your EYLO Calendar too.</p></div>}
      </section>
      <section className="h-fit rounded-2xl border border-border bg-card p-4 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Plan a study session</h2><form onSubmit={addSession} className="space-y-4">
        <Field label="Subject or course" id="study-subject"><input id="study-subject" required maxLength={120} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Research methods" /></Field>
        <Field label="Session title" id="study-title"><input id="study-title" maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Optional: revise sampling methods" /></Field>
        <Field label="Date and time" id="study-start"><input id="study-start" required type="datetime-local" value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></Field>
        <Field label="Preparation notes" id="study-description"><textarea id="study-description" maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Topics, pages, or practice exercises" /></Field>
        <Field label="Project association" id="study-project"><select id="study-project" value={form.project_id} onChange={event => setForm({ ...form, project_id: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}</select></Field>
        <Field label="Reminder" id="study-reminder"><select id="study-reminder" value={form.reminder_minutes} onChange={event => setForm({ ...form, reminder_minutes: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No reminder</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></Field>
        <p className="text-xs text-muted-foreground">Saved in {timezone}. The reminder scheduler checks hourly and adds due alerts to Notifications.</p>
        <button disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16} />}{saving ? 'Saving…' : 'Save study session'}</button>
      </form></section>
    </div>
  </main>;
}

function Stat({ label, value }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>; }
function Field({ label, id, children }) { return <div><label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>; }
