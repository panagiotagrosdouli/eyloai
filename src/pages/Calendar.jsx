import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Clock3, LoaderCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { nextCalendarOccurrence, normalizeCalendarEvent, toDatetimeLocal, visibleCalendarEvents } from '@/lib/calendar-data.mjs';

const nowLocalValue = timezone => toDatetimeLocal(new Date(Date.now() + 60 * 60_000).toISOString(), timezone);
const blankForm = timezone => ({ title: '', description: '', subject: '', status: 'scheduled', event_type: 'event', starts_at: nowLocalValue(timezone), timezone, recurrence: 'none', reminder_minutes: '30', project_id: '' });
const TYPE_LABELS = { event: 'Event', deadline: 'Deadline', exam: 'Exam', study: 'Study session' };
const RECURRENCE_LABELS = { none: 'Does not repeat', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' };
const safeError = error => error?.code === '23505'
  ? 'This calendar entry already exists.'
  : error?.message || 'The calendar request failed. Please retry.';

export default function Calendar() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(() => blankForm(timezone));
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const [eventResult, projectRows] = await Promise.all([
        requireSupabase().from('calendar_events').select('*').eq('user_id', session.user.id).order('starts_at', { ascending: true }).limit(500),
        base44.entities.Project.list('-updated_date', 100),
      ]);
      if (eventResult.error) throw eventResult.error;
      const stillCurrent = await getUsableSession({ required: true, validate: true });
      if (stillCurrent.user.id !== session.user.id) throw new Error('Calendar loading was canceled because your account changed.');
      setEvents(eventResult.data || []); setProjects(projectRows || []);
    } catch (loadError) { setError(safeError(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const visible = visibleCalendarEvents(events, view);
    const needle = query.trim().toLocaleLowerCase();
    return visible.filter(event => !needle || [event.title, event.description, event.event_type, event.timezone]
      .join(' ').toLocaleLowerCase().includes(needle));
  }, [events, query, view]);

  const reset = () => { setForm(blankForm(timezone)); setEditing(null); setSuccess(''); setError(''); };
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const payload = normalizeCalendarEvent(form);
      const queryBuilder = editing
        ? requireSupabase().from('calendar_events').update(payload)
          .eq('id', editing.id).eq('user_id', session.user.id).eq('updated_at', editing.updated_at)
        : requireSupabase().from('calendar_events').insert({ ...payload, user_id: session.user.id });
      const { data, error: writeError } = await queryBuilder.select('*').maybeSingle();
      if (writeError) throw writeError;
      if (!data) throw new Error('This event changed elsewhere. Reload it before editing.');
      const current = await getUsableSession({ required: true, validate: true });
      if (current.user.id !== session.user.id) throw new Error('Save canceled because your account changed.');
      setEvents(previous => [data, ...previous.filter(row => row.id !== data.id)]
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)));
      setSuccess(editing ? 'Calendar entry updated.' : 'Calendar entry saved.');
      setForm(blankForm(timezone)); setEditing(null);
    } catch (saveError) { setError(safeError(saveError)); }
    finally { setSaving(false); }
  };

  const edit = item => {
    setEditing(item);
    setForm({
      title: item.title, description: item.description || '', subject: item.subject || '', status: item.status || 'scheduled', event_type: item.event_type,
      starts_at: toDatetimeLocal(item.starts_at, item.timezone), timezone: item.timezone, recurrence: item.recurrence,
      reminder_minutes: item.reminder_minutes == null ? '' : String(item.reminder_minutes), project_id: item.project_id || '',
    });
    setError(''); setSuccess('');
  };

  const remove = async item => {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    setError(''); setSuccess('');
    try {
      const session = await getUsableSession({ required: true, validate: true });
      const { data, error: deleteError } = await requireSupabase().from('calendar_events').delete()
        .eq('id', item.id).eq('user_id', session.user.id).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Calendar entry not found or access denied.');
      setEvents(previous => previous.filter(row => row.id !== item.id));
      if (editing?.id === item.id) reset();
      setSuccess('Calendar entry deleted.');
    } catch (deleteError) { setError(safeError(deleteError)); }
  };

  const label = (text, id) => <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{text}</label>;

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8" aria-labelledby="calendar-title">
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Productivity</p><h1 id="calendar-title" className="mt-1 text-3xl font-semibold">EYLO Calendar</h1><p className="mt-1 text-sm text-muted-foreground">Events, exams, deadlines, study sessions, project links, and persistent reminders.</p></header>
    {(error || success) && <div role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl border p-3 text-sm ${error ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/5'}`}>{error || success}{error && <button onClick={load} className="ml-3 font-semibold underline">Reload</button>}</div>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Calendar schedule">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="Schedule range">{[['upcoming','Upcoming'],['past','Past'],['all','All']].map(([value,text]) => <button key={value} onClick={() => setView(value)} aria-pressed={view === value} className={`min-h-9 rounded-md px-3 text-sm ${view === value ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground'}`}>{text}</button>)}</div>
          <label className="flex min-h-10 min-w-48 flex-1 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} aria-hidden="true"/><span className="sr-only">Search calendar</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search calendar" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        </div>
        {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading your calendar…</p> : filtered.length ? <ul className="space-y-3">{filtered.map(item => <li key={item.id} className="rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase text-primary">{TYPE_LABELS[item.event_type] || item.event_type}</span>{item.status === 'completed' && <span className="text-xs font-medium text-green-600">Completed</span>}{item.recurrence !== 'none' && <span className="text-xs text-muted-foreground">{RECURRENCE_LABELS[item.recurrence]}</span>}</div><h2 className="mt-2 break-words font-semibold">{item.title}</h2>{item.subject && <p className="mt-1 text-xs font-medium text-primary">{item.subject}</p>}<p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays size={14}/>{new Date(nextCalendarOccurrence(item) ?? item.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone })} · {item.timezone}</p>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>}{item.reminder_minutes != null && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={13}/>Reminder {item.reminder_minutes < 60 ? `${item.reminder_minutes} min` : `${Math.floor(item.reminder_minutes / 60)} hr${item.reminder_minutes >= 120 ? 's' : ''}`} before</p>}{item.project_id && <p className="mt-2 text-xs text-primary">Project: {projects.find(project => project.id === item.project_id)?.title || 'Linked project'}</p>}</div>
          {item.life_item_id ? <Link to="/life" className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-primary">Manage in EYLO Life</Link> : <div className="flex shrink-0 gap-1"><button aria-label={`Edit ${item.title}`} onClick={() => edit(item)} className="rounded-lg p-2 hover:bg-muted"><Pencil size={15}/></button><button aria-label={`Delete ${item.title}`} onClick={() => remove(item)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={15}/></button></div>}</div>
        </li>)}</ul> : <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center"><CalendarDays size={22} className="mx-auto text-muted-foreground"/><p className="mt-3 font-medium">{query ? 'No matching calendar entries.' : 'No calendar entries yet.'}</p><p className="mt-1 text-sm text-muted-foreground">Add an event, deadline, exam, or study session.</p></div>}
      </section>
      <section className="h-fit rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="calendar-form-title">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 id="calendar-form-title" className="text-lg font-semibold">{editing ? 'Edit entry' : 'Add to calendar'}</h2>{editing && <button type="button" onClick={reset} className="text-sm text-primary">Cancel edit</button>}</div>
        <form onSubmit={save} className="space-y-4">
          {label('Title','calendar-entry-title')}<input id="calendar-entry-title" required maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Literature review submission" />
          <div className="grid gap-3 sm:grid-cols-2">{label('Type','calendar-entry-type')}<select id="calendar-entry-type" value={form.event_type} onChange={event => setForm({ ...form, event_type: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm">{Object.entries(TYPE_LABELS).map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select>
          {label('Starts at','calendar-entry-start')}<input id="calendar-entry-start" required type="datetime-local" value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></div>
          {label('Description','calendar-entry-description')}<textarea id="calendar-entry-description" maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Details or preparation notes" />
          <div>{label('Time zone','calendar-entry-timezone')}<input id="calendar-entry-timezone" required maxLength={100} value={form.timezone} onChange={event => setForm({ ...form, timezone: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Europe/Athens" /><p className="mt-1 text-xs text-muted-foreground">Use an IANA zone such as Europe/Athens or America/New_York.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{label('Subject or topic','calendar-entry-subject')}<input id="calendar-entry-subject" maxLength={120} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Optional" />
          {label('Progress','calendar-entry-status')}<select id="calendar-entry-status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="scheduled">Scheduled</option><option value="completed">Completed</option></select></div>
          <div className="grid gap-3 sm:grid-cols-2">{label('Repeats','calendar-entry-recurrence')}<select id="calendar-entry-recurrence" value={form.recurrence} onChange={event => setForm({ ...form, recurrence: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm">{Object.entries(RECURRENCE_LABELS).map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select>
          {label('Reminder','calendar-entry-reminder')}<select id="calendar-entry-reminder" value={form.reminder_minutes} onChange={event => setForm({ ...form, reminder_minutes: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No reminder</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option><option value="10080">1 week before</option></select></div>
          <div>{label('Project link','calendar-entry-project')}<select id="calendar-entry-project" value={form.project_id} onChange={event => setForm({ ...form, project_id: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}</select></div>
          <p className="text-xs text-muted-foreground">Reminders are delivered to EYLO Notifications by the hourly server scheduler.</p>
          <button disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin"/> : editing ? <Check size={16}/> : <Plus size={16} />}{saving ? 'Saving…' : editing ? 'Save changes' : 'Save calendar entry'}</button>
        </form>
      </section>
    </div>
  </main>;
}
