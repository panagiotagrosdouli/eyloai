import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Check, GraduationCap, Plus, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isOverdueLifeTask, nextLifeTaskDate, normalizeLifeTask, sortLifeTasks } from '@/lib/life-domain.mjs';

const EMPTY_ITEM = { title: '', description: '', status: 'todo', priority: 'normal', recurrence: 'none', area: 'study', kind: 'study', course: '', syllabus_item: '', due_date: '', project_id: '' };
const copyItem = item => ({ ...EMPTY_ITEM, ...(item || {}), due_date: item?.due_date || '', project_id: item?.project_id || '' });
const sameItem = (left, right) => JSON.stringify(copyItem(left)) === JSON.stringify(copyItem(right));

function dateLabel(value) {
  if (!value) return 'No date set';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function todayLocal() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const KIND_LABELS = { study: 'Study session', syllabus: 'Syllabus item', exam: 'Examination', task: 'Study task' };

export default function StudyPlanner() {
  const { user } = useAuth();
  const ownerRef = useRef(user?.id || null);
  const [items, setItems] = useState([]);
  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(EMPTY_ITEM);
  const [baseline, setBaseline] = useState(EMPTY_ITEM);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !sameItem(editor, baseline);

  const load = async (ownerId = ownerRef.current) => {
    if (!ownerId || ownerId !== ownerRef.current) return;
    setLoading(true);
    setError('');
    const [itemResult, goalResult, projectResult] = await Promise.allSettled([
      base44.entities.LifeTask.filter({ area: 'study' }, '-updated_date', 1000),
      base44.entities.LifeGoal.filter({ area: 'study' }, '-updated_date', 1000),
      base44.entities.Project.list('-updated_date', 1000),
    ]);
    if (ownerId !== ownerRef.current) return;
    if (itemResult.status === 'fulfilled') setItems(sortLifeTasks(itemResult.value));
    else setError('Study plan could not be loaded. Check your connection and retry.');
    if (goalResult.status === 'fulfilled') setGoals(goalResult.value);
    else setNotice('Study goals could not be loaded. Your saved study items remain available.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    else setNotice('Projects could not be loaded. Study items remain available without project links.');
    setLoading(false);
  };

  useEffect(() => {
    ownerRef.current = user?.id || null;
    setItems([]);
    setGoals([]);
    setProjects([]);
    setSelected(null);
    setEditor(EMPTY_ITEM);
    setBaseline(EMPTY_ITEM);
    setError('');
    setNotice('');
    if (user?.id) void load(user.id);
    else setLoading(false);
  }, [user?.id]);

  const counts = useMemo(() => ({
    total: items.length,
    open: items.filter(item => item.status !== 'done').length,
    overdue: items.filter(item => isOverdueLifeTask(item, todayLocal())).length,
    exams: items.filter(item => item.kind === 'exam' && item.status !== 'done').length,
  }), [items]);

  const visible = useMemo(() => items.filter(item => {
    if (filter === 'upcoming') return item.status !== 'done';
    if (filter === 'overdue') return isOverdueLifeTask(item, todayLocal());
    if (filter === 'exams') return item.kind === 'exam';
    if (filter === 'completed') return item.status === 'done';
    return true;
  }), [items, filter]);

  const resetEditor = () => {
    setSelected(null);
    setEditor(EMPTY_ITEM);
    setBaseline(EMPTY_ITEM);
    setError('');
    setNotice('New study plan item. Save to add it to your schedule.');
  };

  const chooseItem = item => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const next = copyItem(item);
    setSelected(item);
    setEditor(next);
    setBaseline(next);
    setError('');
    setNotice('');
  };

  const save = async event => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = normalizeLifeTask({ ...editor, area: 'study' });
      const project = projects.find(item => item.id === payload.project_id);
      const savePayload = { ...payload, project_title: project?.title || (payload.project_id === selected?.project_id ? selected?.project_title : '') || '' };
      const saved = selected
        ? await base44.entities.LifeTask.updateIfUnchanged(selected.id, savePayload, selected.updated_date)
        : await base44.entities.LifeTask.create(savePayload);
      if (ownerId !== ownerRef.current) return;
      setSelected(saved);
      setEditor(copyItem(saved));
      setBaseline(copyItem(saved));
      setItems(current => sortLifeTasks([saved, ...current.filter(item => item.id !== saved.id)]));
      setNotice('Study item saved.');
    } catch (saveError) {
      if (ownerId !== ownerRef.current) return;
      setError(saveError?.code === 'ENTITY_CONFLICT'
        ? 'This study item changed in another tab. Reload the latest version before saving.'
        : saveError?.message || 'The study item could not be saved. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const complete = async item => {
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    const status = item.status === 'done' ? 'todo' : 'done';
    try {
      const saved = await base44.entities.LifeTask.updateIfUnchanged(item.id, { status }, item.updated_date);
      if (ownerId !== ownerRef.current) return;
      let nextOccurrence = null;
      if (status === 'done' && item.recurrence && item.recurrence !== 'none' && item.due_date) {
        const nextDate = nextLifeTaskDate(item.due_date, item.recurrence);
        const parentId = item.recurrence_parent_id || item.id;
        const existing = await base44.entities.LifeTask.filter({ recurrence_parent_id: parentId, recurrence_instance_date: nextDate }, '-created_date', 1);
        if (ownerId !== ownerRef.current) return;
        nextOccurrence = existing[0] || await base44.entities.LifeTask.create({
          title: item.title,
          description: item.description || '',
          status: 'todo',
          priority: item.priority || 'normal',
          recurrence: item.recurrence,
          recurrence_parent_id: parentId,
          recurrence_instance_date: nextDate,
          area: 'study',
          kind: item.kind || 'study',
          course: item.course || '',
          syllabus_item: item.syllabus_item || '',
          due_date: nextDate,
          project_id: item.project_id || null,
          project_title: item.project_title || '',
        });
      }
      if (ownerId !== ownerRef.current) return;
      setItems(current => sortLifeTasks([
        ...current.map(value => value.id === saved.id ? saved : value),
        ...(nextOccurrence && !current.some(value => value.id === nextOccurrence.id) ? [nextOccurrence] : []),
      ]));
      if (selected?.id === saved.id) {
        setSelected(saved);
        setEditor(copyItem(saved));
        setBaseline(copyItem(saved));
      }
    } catch (updateError) {
      if (ownerId === ownerRef.current) setError(updateError?.code === 'ENTITY_CONFLICT' ? 'This study item changed elsewhere. Reload it before updating.' : updateError?.message || 'Study item status could not be updated.');
    }
  };

  const projectNames = useMemo(() => new Map(projects.map(project => [project.id, project.title || 'Untitled project'])), [projects]);
  const courses = useMemo(() => [...new Set(items.map(item => item.course).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [items]);

  return (
    <div className="eylo-page max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="eylo-eyebrow">Learning workspace</p><h1 className="eylo-page-heading">Study Planner</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Organize courses, syllabus items, study sessions and exam dates in your private schedule.</p></div>
        <div className="flex gap-2"><Link to="/life/goals" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Study goals</Link><button type="button" onClick={resetEditor} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus size={16} /> Add to plan</button></div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Study plan summary">
        {[
          { label: 'Plan items', value: counts.total, Icon: BookOpen },
          { label: 'Open', value: counts.open, Icon: GraduationCap },
          { label: 'Overdue', value: counts.overdue, Icon: CalendarDays },
          { label: 'Upcoming exams', value: counts.exams, Icon: CalendarDays },
        ].map(({ label, value, Icon }) => <div key={label} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={14} />{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>)}
      </div>

      {courses.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"><span className="text-xs font-semibold">Courses</span>{courses.map(course => <span key={course} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">{course}</span>)}</div>}
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Reload</button></div>}
      {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="study-items-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="study-items-heading" className="text-sm font-semibold">Schedule <span className="font-normal text-muted-foreground">({visible.length})</span></h2><label className="sr-only" htmlFor="study-filter">Filter plan items</label><select id="study-filter" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-3 text-xs"><option value="upcoming">Open items</option><option value="all">All items</option><option value="overdue">Overdue</option><option value="exams">Exams</option><option value="completed">Completed</option></select></div>
          {loading ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading study plan…</p>
            : visible.length ? <ul className="space-y-2">{visible.map(item => <li key={item.id} className={`rounded-lg border px-3 py-3 ${selected?.id === item.id ? 'border-primary/40 bg-primary/5' : 'border-border'}`}><div className="flex items-start gap-3"><button type="button" onClick={() => void complete(item)} aria-label={`${item.status === 'done' ? 'Reopen' : 'Complete'} ${item.title}`} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${item.status === 'done' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{item.status === 'done' && <Check size={12} />}</button><button type="button" onClick={() => chooseItem(item)} className="min-w-0 flex-1 text-left"><span className={`block truncate text-sm font-medium ${item.status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{item.title}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>{KIND_LABELS[item.kind] || 'Study task'}</span><span>{dateLabel(item.due_date)}</span>{item.course && <span>{item.course}</span>}{item.syllabus_item && <span>{item.syllabus_item}</span>}{item.project_id && <span>{projectNames.get(item.project_id) || item.project_title || 'Linked project'}</span>}</span></button></div></li>)}</ul>
              : <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center"><BookOpen size={24} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-medium">No study items yet</p><p className="mt-1 text-xs text-muted-foreground">Add a syllabus section, study session or exam date to start your plan.</p><button type="button" onClick={resetEditor} className="mt-3 text-xs font-semibold text-primary underline">Add first item</button></div>}
          {goals.length > 0 && <div className="mt-5 border-t border-border pt-4"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold">Study goals</h3><Link to="/life/goals" className="text-xs text-primary underline">Manage goals</Link></div><ul className="mt-2 space-y-2">{goals.map(goal => <li key={goal.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{goal.title}</span><span className="shrink-0 text-muted-foreground">{goal.milestones?.filter(step => step.complete).length || 0}/{goal.milestones?.length || 0} milestones</span></li>)}</ul></div>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Study plan item editor"><form onSubmit={save}><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{selected ? 'Edit plan item' : 'New plan item'}</h2><button type="submit" disabled={saving || (!dirty && Boolean(selected))} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={14} />{saving ? 'Saving…' : 'Save item'}</button></div>
          <label htmlFor="study-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</label><input id="study-title" required maxLength={160} value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} placeholder="Study a topic or prepare for an exam" className="mb-4 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Type<select value={editor.kind} onChange={event => setEditor(current => ({ ...current, kind: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="study">Study session</option><option value="syllabus">Syllabus item</option><option value="exam">Examination</option><option value="task">Other study task</option></select></label><label className="text-xs font-medium text-muted-foreground">Course or subject<input maxLength={160} value={editor.course} onChange={event => setEditor(current => ({ ...current, course: event.target.value }))} placeholder="Course name" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label></div>
          <label htmlFor="study-syllabus" className="mb-1.5 block text-xs font-medium text-muted-foreground">Syllabus section or learning objective</label><input id="study-syllabus" maxLength={200} value={editor.syllabus_item} onChange={event => setEditor(current => ({ ...current, syllabus_item: event.target.value }))} placeholder="Chapter, unit or objective" className="mb-4 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          <label htmlFor="study-description" className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes</label><textarea id="study-description" rows={3} maxLength={5000} value={editor.description} onChange={event => setEditor(current => ({ ...current, description: event.target.value }))} placeholder="Add study priorities or preparation notes" className="mb-4 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-muted-foreground">Date<input type="date" value={editor.due_date} onChange={event => setEditor(current => ({ ...current, due_date: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><label className="text-xs font-medium text-muted-foreground">Priority<select value={editor.priority} onChange={event => setEditor(current => ({ ...current, priority: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="text-xs font-medium text-muted-foreground">Status<select value={editor.status} onChange={event => setEditor(current => ({ ...current, status: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label><label className="text-xs font-medium text-muted-foreground">Linked project<select value={editor.project_id} onChange={event => setEditor(current => ({ ...current, project_id: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}</select></label></div>
          <p className="mt-4 text-[11px] text-muted-foreground">Saved in the same private task system as EYLO Life, so your study schedule stays connected to your workspace.</p>
        </form></section>
      </div>
    </div>
  );
}
