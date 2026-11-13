import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { eventsForMonth, nextEventStart, normalizeCalendarEvent, eventOccursOnDay, calendarEventLabel } from '@/lib/calendar-domain.mjs';

const EMPTY = { title: '', description: '', start_at: '', end_at: '', reminder_at: '', recurrence: 'none', project_id: '', all_day: false };
const toLocalInput = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const copy = item => ({ ...EMPTY, ...(item || {}), start_at: item?.all_day ? item.start_at?.slice(0, 10) || '' : toLocalInput(item?.start_at), end_at: item?.all_day ? item.end_at?.slice(0, 10) || '' : toLocalInput(item?.end_at), reminder_at: toLocalInput(item?.reminder_at) });
const equal = (a, b) => JSON.stringify(copy(a)) === JSON.stringify(copy(b));
const asLocalInput = value => value ? new Date(value).toISOString() : null;

function defaultEditor() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const local = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { ...EMPTY, start_at: local(start), end_at: local(end) };
}

export default function Calendar() {
  const { user } = useAuth();
  const owner = useRef(user?.id || null);
  const focusedEventRef = useRef(false);
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(defaultEditor);
  const [baseline, setBaseline] = useState(defaultEditor);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !equal(editor, baseline);

  const load = async (ownerId = owner.current) => {
    if (!ownerId || ownerId !== owner.current) return;
    setLoading(true); setError('');
    const [eventResult, projectResult] = await Promise.allSettled([
      base44.entities.CalendarEvent.list('-updated_date', 1000),
      base44.entities.Project.list('-updated_date', 1000),
    ]);
    if (ownerId !== owner.current) return;
    if (eventResult.status === 'fulfilled') setEvents(eventResult.value.sort((a, b) => a.start_at.localeCompare(b.start_at)));
    else setError('Calendar could not be loaded. Check your connection and retry.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    setLoading(false);
  };

  useEffect(() => {
    owner.current = user?.id || null;
    focusedEventRef.current = false;
    setEvents([]); setProjects([]); setSelected(null); setEditor(defaultEditor()); setBaseline(defaultEditor());
    setError(''); setNotice('');
    if (user?.id) void load(user.id); else setLoading(false);
  }, [user?.id]);

  const monthEvents = useMemo(() => eventsForMonth(events, viewDate.getFullYear(), viewDate.getMonth()), [events, viewDate]);
  const startMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const days = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const projectMap = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);

  const create = () => {
    if (dirty && !window.confirm('Discard unsaved event changes?')) return;
    const value = defaultEditor(); setSelected(null); setEditor(value); setBaseline(value); setError(''); setNotice('New event. Save to add it to your calendar.');
  };
  const choose = event => {
    if (dirty && !window.confirm('Discard unsaved event changes?')) return;
    const value = copy(event); setSelected(event); setEditor(value); setBaseline(value); setError(''); setNotice('');
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    const focusId = new URLSearchParams(window.location.search).get('focus');
    const match = focusId && !focusedEventRef.current ? events.find(event => String(event.id) === focusId) : null;
    if (match) { focusedEventRef.current = true; chooseRef.current(match); }
  }, [events]);
  const save = async e => {
    e.preventDefault(); const userId = owner.current; if (!userId) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const payload = normalizeCalendarEvent({ ...editor, start_at: editor.all_day ? `${editor.start_at}T00:00:00Z` : asLocalInput(editor.start_at), end_at: editor.all_day ? `${editor.end_at}T00:00:00Z` : asLocalInput(editor.end_at), reminder_at: editor.reminder_at ? asLocalInput(editor.reminder_at) : null });
      const project = projectMap.get(payload.project_id);
      const data = { ...payload, project_title: project?.title || '' };
      const saved = selected ? await base44.entities.CalendarEvent.updateIfUnchanged(selected.id, data, selected.updated_date) : await base44.entities.CalendarEvent.create(data);
      if (userId !== owner.current) return;
      setEvents(current => [...current.filter(item => item.id !== saved.id), saved].sort((a, b) => a.start_at.localeCompare(b.start_at)));
      const value = copy(saved); setSelected(saved); setEditor(value); setBaseline(value); setNotice('Event saved.');
    } catch (saveError) {
      if (userId === owner.current) setError(saveError?.code === 'ENTITY_CONFLICT' ? 'This event changed in another tab. Reload before saving.' : saveError?.message || 'Event could not be saved. Your edits are still here.');
    } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!selected || !window.confirm(`Delete “${selected.title}”?`)) return;
    const userId = owner.current;
    try { await base44.entities.CalendarEvent.delete(selected.id); if (userId !== owner.current) return; setEvents(items => items.filter(item => item.id !== selected.id)); create(); setNotice('Event deleted.'); }
    catch (removeError) { setError(removeError?.message || 'Event could not be deleted.'); }
  };
  const scheduleNext = async () => {
    if (!selected || selected.recurrence === 'none') return;
    const userId = owner.current; setError('');
    try {
      const start = nextEventStart(selected.start_at, selected.recurrence);
      const duration = Date.parse(selected.end_at) - Date.parse(selected.start_at);
      const next = await base44.entities.CalendarEvent.create({ ...selected, id: undefined, start_at: start, end_at: new Date(Date.parse(start) + duration).toISOString(), reminder_at: null });
      if (userId !== owner.current) return;
      setEvents(items => [...items, next].sort((a, b) => a.start_at.localeCompare(b.start_at)));
      setNotice('Next occurrence added to your calendar.');
    } catch (nextError) { setError(nextError?.message || 'Next occurrence could not be created.'); }
  };

  return <div className="eylo-page max-w-7xl">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="eylo-eyebrow">Personal workspace</p><h1 className="eylo-page-heading">Calendar</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Create private events, connect them to projects, and keep deadlines visible. Reminders are saved with each event; external calendar sync is not connected.</p></div><button type="button" onClick={create} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus size={16}/>New event</button></header>
    {error && <div role="alert" className="mb-4 flex justify-between gap-3 rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Reload</button></div>}
    {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Monthly calendar">
        <div className="mb-4 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-border"><ChevronLeft size={17}/></button><h2 className="font-semibold">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(viewDate)}</h2><button type="button" aria-label="Next month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-border"><ChevronRight size={17}/></button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} className="py-2">{day}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">{Array.from({ length: startMonth }, (_, i) => <span key={`empty-${i}`} aria-hidden="true"/>)}{Array.from({ length: days }, (_, i) => { const day = i + 1; const count = monthEvents.filter(event => eventOccursOnDay(event, viewDate.getFullYear(), viewDate.getMonth(), day)).length; return <button key={day} type="button" onClick={() => { const event = monthEvents.find(item => eventOccursOnDay(item, viewDate.getFullYear(), viewDate.getMonth(), day)); if (event) choose(event); }} aria-label={`${day}, ${count} events`} className={`min-h-12 rounded-lg border text-sm ${count ? 'border-primary/30 bg-primary/5 font-semibold text-primary' : 'border-transparent hover:border-border'}`}>{day}{count > 0 && <span className="block text-[10px]">{count} event{count === 1 ? '' : 's'}</span>}</button>; })}</div>
        <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={15}/>Events this month ({monthEvents.length})</h2>
        {loading ? <p role="status" className="py-5 text-center text-sm text-muted-foreground">Loading events…</p> : monthEvents.length ? <ul className="space-y-2">{monthEvents.map(event => <li key={event.id}><button type="button" onClick={() => choose(event)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === event.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-secondary/50'}`}><span className="font-medium">{event.title}</span><span className="mt-1 block text-xs text-muted-foreground">{calendarEventLabel(event)} · {event.project_title || 'Personal'}</span></button></li>)}</ul> : <p className="py-5 text-center text-sm text-muted-foreground">No events in this month.</p>}
      </section>
      <form onSubmit={save} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{selected ? 'Edit event' : 'New event'}</h2>
        <label className="block text-xs font-medium">Title<input required maxLength={160} value={editor.title} onChange={e => setEditor(v => ({ ...v, title: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"/></label>
        <label className="block text-xs font-medium">Description<textarea maxLength={4000} rows={3} value={editor.description} onChange={e => setEditor(v => ({ ...v, description: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.all_day} onChange={e => setEditor(v => ({ ...v, all_day: e.target.checked, start_at: e.target.checked ? v.start_at.slice(0, 10) : `${v.start_at}T00:00`, end_at: e.target.checked ? v.end_at.slice(0, 10) : `${v.end_at}T00:00` }))}/>All-day event</label>
        {editor.all_day && <p className="text-xs text-muted-foreground">Dates stay the same in every timezone. The end date is exclusive: for a one-day event, choose the following day as the end.</p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Starts<input type={editor.all_day ? "date" : "datetime-local"} required value={editor.start_at} onChange={e => setEditor(v => ({ ...v, start_at: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"/></label><label className="text-xs font-medium">Ends<input type={editor.all_day ? "date" : "datetime-local"} required value={editor.end_at} onChange={e => setEditor(v => ({ ...v, end_at: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-sm"/></label></div>
        <label className="block text-xs font-medium">Reminder time<input type="datetime-local" value={editor.reminder_at} onChange={e => setEditor(v => ({ ...v, reminder_at: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"/><span className="mt-1 block font-normal text-muted-foreground">Stored on the event; delivery is not configured.</span></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Repeat<select value={editor.recurrence} onChange={e => setEditor(v => ({ ...v, recurrence: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label className="text-xs font-medium">Project<select value={editor.project_id} onChange={e => setEditor(v => ({ ...v, project_id: e.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}</select></label></div>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving || !dirty} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={15}/>{saving ? 'Saving…' : 'Save event'}</button>{selected && <><button type="button" onClick={() => void scheduleNext()} disabled={selected.recurrence === 'none'} className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Add next occurrence</button><button type="button" onClick={() => void remove()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-destructive/30 px-3 text-sm text-destructive"><Trash2 size={15}/>Delete</button></>}</div>
      </form>
    </div>
  </div>;
}

