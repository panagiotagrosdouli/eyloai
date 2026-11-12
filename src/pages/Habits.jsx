import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Flame, Save, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { nextLifeTaskDate, normalizeLifeTask, summarizeHabits } from '@/lib/life-domain.mjs';

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(value) {
  if (!value) return 'No date set';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function Habits() {
  const { user } = useAuth();
  const ownerRef = useRef(user?.id || null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [startDate, setStartDate] = useState(todayLocal);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (ownerId = ownerRef.current) => {
    if (!ownerId || ownerId !== ownerRef.current) return;
    setLoading(true);
    setError('');
    try {
      const result = await base44.entities.LifeTask.filter({ kind: 'habit' }, '-updated_date', 1000);
      if (ownerId === ownerRef.current) setTasks(result);
    } catch {
      if (ownerId === ownerRef.current) setError('Habits could not be loaded. Check your connection and retry.');
    } finally {
      if (ownerId === ownerRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    ownerRef.current = user?.id || null;
    setTasks([]);
    setTitle('');
    setDescription('');
    setError('');
    setNotice('');
    if (user?.id) void load(user.id);
    else setLoading(false);
  }, [user?.id]);

  const habits = useMemo(() => summarizeHabits(tasks, todayLocal()), [tasks]);
  const completedToday = habits.filter(habit => habit.completedDates.includes(todayLocal())).length;
  const totalCheckins = habits.reduce((sum, habit) => sum + habit.completedCount, 0);

  const createHabit = async event => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const habit = normalizeLifeTask({
        title, description, area: 'personal', kind: 'habit', status: 'todo', priority: 'normal',
        recurrence: frequency, due_date: startDate,
      });
      const created = await base44.entities.LifeTask.create(habit);
      if (ownerId !== ownerRef.current) return;
      setTasks(current => [...current, created]);
      setTitle('');
      setDescription('');
      setNotice('Habit saved. Check it off to record a completion and schedule the next occurrence.');
    } catch (createError) {
      if (ownerId === ownerRef.current) setError(createError?.message || 'The habit could not be saved. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const completeHabit = async habit => {
    const ownerId = ownerRef.current;
    const current = habit.current;
    if (!ownerId || !current) return;
    setError('');
    try {
      const completed = current.status === 'done'
        ? current
        : await base44.entities.LifeTask.updateIfUnchanged(current.id, { status: 'done' }, current.updated_date);
      if (ownerId !== ownerRef.current) return;
      const nextDate = nextLifeTaskDate(current.due_date, habit.frequency);
      const parentId = current.recurrence_parent_id || current.id;
      const existing = await base44.entities.LifeTask.filter({ recurrence_parent_id: parentId, recurrence_instance_date: nextDate }, '-created_date', 1);
      if (ownerId !== ownerRef.current) return;
      const next = existing[0] || await base44.entities.LifeTask.create({
        title: current.title,
        description: current.description || '',
        status: 'todo',
        priority: current.priority || 'normal',
        recurrence: habit.frequency,
        recurrence_parent_id: parentId,
        recurrence_instance_date: nextDate,
        area: 'personal',
        kind: 'habit',
        due_date: nextDate,
      });
      if (ownerId !== ownerRef.current) return;
      setTasks(old => [...old.filter(item => item.id !== completed.id && item.id !== next.id), completed, next]);
      setNotice(current.status === 'done'
        ? `Next check-in scheduled for ${dateLabel(next.due_date)}.`
        : `Recorded for ${dateLabel(completed.due_date)}. Next check-in is ${dateLabel(next.due_date)}.`);
    } catch (completeError) {
      if (ownerId === ownerRef.current) setError(completeError?.code === 'ENTITY_CONFLICT'
        ? 'This habit changed in another tab. Reload before checking it off.'
        : completeError?.message || 'The habit completion could not be saved. Retry in a moment.');
    }
  };

  const deleteHabit = async habit => {
    if (!window.confirm(`Delete “${habit.title}” and its ${habit.occurrences.length} saved occurrences?`)) return;
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    try {
      for (const occurrence of habit.occurrences) {
        await base44.entities.LifeTask.delete(occurrence.id);
        if (ownerId !== ownerRef.current) return;
      }
      setTasks(current => current.filter(item => !habit.occurrences.some(occurrence => occurrence.id === item.id)));
      setNotice(`Deleted “${habit.title}” and its saved occurrences.`);
    } catch (deleteError) {
      if (ownerId === ownerRef.current) {
        setError(deleteError?.message || 'Some occurrences could not be deleted. Reload to see the saved state.');
        void load(ownerId);
      }
    }
  };

  return (
    <div className="eylo-page max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="eylo-eyebrow">Personal organization</p><h1 className="eylo-page-heading">Habits</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Track daily or weekly routines from real check-ins. Streaks count only saved completions.</p></div><Link to="/life" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Open Life tasks</Link></header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Habit summary"><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Habits</p><p className="mt-2 text-2xl font-semibold tabular-nums">{habits.length}</p></div><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Checked in today</p><p className="mt-2 text-2xl font-semibold tabular-nums">{completedToday}</p></div><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total saved check-ins</p><p className="mt-2 text-2xl font-semibold tabular-nums">{totalCheckins}</p></div></div>
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button></div>}
      {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="habit-list-heading"><h2 id="habit-list-heading" className="mb-4 text-sm font-semibold">Your routines <span className="font-normal text-muted-foreground">({habits.length})</span></h2>
          {loading ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading habits…</p>
            : habits.length ? <ul className="space-y-3">{habits.map(habit => {
              const checkedToday = habit.completedDates.includes(todayLocal());
              const needsScheduleRetry = habit.current?.status === 'done' && !habit.occurrences.some(item => item.status !== 'done');
              return <li key={habit.id} className="rounded-xl border border-border p-4"><div className="flex items-start gap-3"><button type="button" onClick={() => void completeHabit(habit)} disabled={(checkedToday && !needsScheduleRetry) || !habit.current} aria-label={`${needsScheduleRetry ? 'Retry scheduling' : 'Check in'} for ${habit.title}`} className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 text-primary hover:bg-primary/10 disabled:bg-primary disabled:text-primary-foreground">{checkedToday || habit.current?.status === 'done' ? <Check size={15} /> : <span className="text-[10px]">✓</span>}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="truncate text-sm font-semibold">{habit.title}</h3><button type="button" onClick={() => void deleteHabit(habit)} aria-label={`Delete habit ${habit.title}`} className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></div>{habit.description && <p className="mt-1 text-xs text-muted-foreground">{habit.description}</p>}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>{habit.frequency === 'weekly' ? 'Weekly' : 'Daily'}</span><span>Next: {dateLabel(habit.current?.due_date)}</span><span>{habit.completedCount} check-ins saved</span></div><div className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"><Flame size={13} className={habit.currentStreak ? 'text-orange-500' : 'text-muted-foreground'} /><span>{habit.currentStreak} {habit.frequency === 'weekly' ? 'week' : 'day'} streak</span></div>{needsScheduleRetry && <p className="mt-2 text-[11px] text-primary">Next check-in needs scheduling. Press the check button to retry.</p>}{checkedToday && <p className="mt-2 text-[11px] text-primary">Checked in today.</p>}</div></div></li>;
            })}</ul>
              : <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center"><Flame size={24} aria-hidden="true" className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-medium">No habits tracked</p><p className="mt-1 text-xs text-muted-foreground">Add a routine to begin building a check-in history.</p></div>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="New habit form"><form onSubmit={createHabit}><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Add a routine</h2><button type="submit" disabled={saving || !title.trim()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save habit'}</button></div>
          <label htmlFor="habit-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">Habit</label><input id="habit-title" required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Read for 20 minutes" className="mb-4 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          <label htmlFor="habit-description" className="mb-1.5 block text-xs font-medium text-muted-foreground">Details</label><textarea id="habit-description" rows={3} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional notes about your routine" className="mb-4 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Frequency<select value={frequency} onChange={event => setFrequency(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label className="text-xs font-medium text-muted-foreground">First check-in date<input required type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label></div>
          <p className="mt-4 text-[11px] text-muted-foreground">Check-ins are stored as completed Life tasks. Completing one schedules the next day or week, and the app prevents duplicate occurrences.</p>
        </form></section>
      </div>
    </div>
  );
}
