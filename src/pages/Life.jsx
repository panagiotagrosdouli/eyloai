import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Circle, Clock3, Plus, Save, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isOverdueLifeTask, nextLifeTaskDate, normalizeLifeTask, sortLifeTasks } from '@/lib/life-domain.mjs';
import { loadExactLifeTask, TASK_TARGET_ERROR } from '@/lib/life-task-target.mjs';

const EMPTY_TASK = { title: '', description: '', status: 'todo', priority: 'normal', recurrence: 'none', area: 'personal', kind: 'task', course: '', syllabus_item: '', due_date: '', project_id: '' };
const copyTask = task => ({ ...EMPTY_TASK, ...(task || {}), due_date: task?.due_date || '', project_id: task?.project_id || '' });
const sameTask = (left, right) => JSON.stringify(copyTask(left)) === JSON.stringify(copyTask(right));

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Life() {
  const { user } = useAuth();
  const ownerRef = useRef(user?.id || null);
  const [params] = useSearchParams();
  const focusId = params.get('focus') || '';
  const focusedTaskRef = useRef('');
  const focusGeneration = useRef(0);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(EMPTY_TASK);
  const [baseline, setBaseline] = useState(EMPTY_TASK);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !sameTask(editor, baseline);

  const load = async (ownerId = ownerRef.current) => {
    if (!ownerId || ownerId !== ownerRef.current) return;
    setLoading(true);
    setError('');
    const [taskResult, projectResult] = await Promise.allSettled([
      base44.entities.LifeTask.list('-updated_date', 1000),
      base44.entities.Project.list('-updated_date', 1000),
    ]);
    if (ownerId !== ownerRef.current) return;
    if (taskResult.status === 'fulfilled') setTasks(sortLifeTasks(taskResult.value));
    else setError('Tasks could not be loaded. Check your connection and retry.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    else setNotice('Projects could not be loaded. Tasks can still be managed without project links.');
    setLoading(false);
  };

  useEffect(() => {
    ownerRef.current = user?.id || null;
    focusedTaskRef.current = '';
    focusGeneration.current += 1;
    setLoadingTarget(false);
    setTasks([]);
    setProjects([]);
    setSelected(null);
    setEditor(EMPTY_TASK);
    setBaseline(EMPTY_TASK);
    setError('');
    setNotice('');
    if (user?.id) void load(user.id);
    else setLoading(false);
  }, [user?.id]);

  const counts = useMemo(() => ({
    open: tasks.filter(task => task.status !== 'done').length,
    dueToday: tasks.filter(task => task.status !== 'done' && task.due_date === localDateString()).length,
    overdue: tasks.filter(task => isOverdueLifeTask(task)).length,
    done: tasks.filter(task => task.status === 'done').length,
  }), [tasks]);

  const visibleTasks = useMemo(() => tasks.filter(task => {
    if (filter === 'open') return task.status !== 'done';
    if (filter === 'done') return task.status === 'done';
    if (filter === 'overdue') return isOverdueLifeTask(task);
    return true;
  }), [tasks, filter]);

  const resetEditor = () => {
    if (saving) return;
    focusGeneration.current += 1;
    setLoadingTarget(false);
    setSelected(null);
    setEditor(EMPTY_TASK);
    setBaseline(EMPTY_TASK);
    setError('');
    setNotice('New task. Save it to add it to your Life workspace.');
  };

  const chooseTask = task => {
    if (saving) return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    focusGeneration.current += 1;
    setLoadingTarget(false);
    const next = copyTask(task);
    setSelected(task);
    setEditor(next);
    setBaseline(next);
    setError('');
    setNotice('');
  };
  const chooseTaskRef = useRef(chooseTask);
  chooseTaskRef.current = chooseTask;
  useEffect(() => {
    if (!focusId) { focusedTaskRef.current = ''; if (loadingTarget) { focusGeneration.current += 1; setLoadingTarget(false); setNotice(''); } return; }
    if (loading || saving || !user?.id || focusedTaskRef.current === focusId) return;
    focusedTaskRef.current = focusId;
    const match = tasks.find(task => String(task.id) === focusId);
    if (match) { chooseTaskRef.current(match); return; }
    if (dirty && !window.confirm('Discard unsaved changes to open the requested task?')) return;
    const ownerId = ownerRef.current, generation = ++focusGeneration.current;
    let cancelled = false;
    setSelected(null); setEditor(EMPTY_TASK); setBaseline(EMPTY_TASK);
    setError(''); setNotice('Loading the requested private task…'); setLoadingTarget(true);
    void loadExactLifeTask({ repository: base44.entities.LifeTask, id: focusId, ownerId }).then(task => {
      if (cancelled || generation !== focusGeneration.current || ownerId !== ownerRef.current) return;
      setTasks(current => current.some(item => item.id === task.id) ? current : sortLifeTasks([task, ...current]));
      chooseTaskRef.current(task);
    }).catch(() => {
      if (cancelled || generation !== focusGeneration.current || ownerId !== ownerRef.current) return;
      focusedTaskRef.current = ''; setNotice(''); setError(TASK_TARGET_ERROR);
    }).finally(() => { if (!cancelled && ownerId === ownerRef.current) setLoadingTarget(false); });
    return () => { cancelled = true; if (focusedTaskRef.current === focusId) focusedTaskRef.current = ''; };
    // Target/owner/reload drive retrieval; typing and insertion must not cancel it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, loading, saving, user?.id]);

  const saveTask = async event => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId || loadingTarget || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = normalizeLifeTask(editor);
      const project = projects.find(item => item.id === payload.project_id);
      const savePayload = { ...payload, project_title: project?.title || (payload.project_id === selected?.project_id ? selected?.project_title : '') || '' };
      const saved = selected
        ? await base44.entities.LifeTask.updateIfUnchanged(selected.id, savePayload, selected.updated_date)
        : await base44.entities.LifeTask.create(savePayload);
      if (ownerId !== ownerRef.current) return;
      setSelected(saved);
      setEditor(copyTask(saved));
      setBaseline(copyTask(saved));
      setTasks(current => sortLifeTasks([saved, ...current.filter(task => task.id !== saved.id)]));
      setNotice('Task saved.');
    } catch (saveError) {
      if (ownerId !== ownerRef.current) return;
      setError(saveError?.code === 'ENTITY_CONFLICT'
        ? 'This task changed in another tab. Reload the latest version before saving.'
        : saveError?.message || 'The task could not be saved. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!selected || !window.confirm('Delete this task?')) return;
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    try {
      await base44.entities.LifeTask.delete(selected.id);
      if (ownerId !== ownerRef.current) return;
      setTasks(current => current.filter(task => task.id !== selected.id));
      resetEditor();
      setNotice('Task deleted.');
    } catch (deleteError) {
      if (ownerId === ownerRef.current) setError(deleteError?.message || 'The task could not be deleted. Retry in a moment.');
    }
  };

  const cycleStatus = async task => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    try {
      const updated = await base44.entities.LifeTask.updateIfUnchanged(task.id, { status: nextStatus }, task.updated_date);
      if (ownerId !== ownerRef.current) return;
      let nextOccurrence = null;
      if (nextStatus === 'done' && task.recurrence && task.recurrence !== 'none' && task.due_date) {
        const nextDate = nextLifeTaskDate(task.due_date, task.recurrence);
        const parentId = task.recurrence_parent_id || task.id;
        const existing = await base44.entities.LifeTask.filter({
          recurrence_parent_id: parentId,
          recurrence_instance_date: nextDate,
        }, '-created_date', 1);
        if (ownerId !== ownerRef.current) return;
        nextOccurrence = existing[0] || await base44.entities.LifeTask.create({
          title: task.title,
          description: task.description || '',
          status: 'todo',
          priority: task.priority || 'normal',
          recurrence: task.recurrence,
          area: task.area || 'personal',
          kind: task.kind || 'task',
          course: task.course || '',
          syllabus_item: task.syllabus_item || '',
          recurrence_parent_id: parentId,
          recurrence_instance_date: nextDate,
          due_date: nextDate,
          project_id: task.project_id || null,
          project_title: task.project_title || '',
        });
      }
      if (ownerId !== ownerRef.current) return;
      if (task.id === selected?.id) {
        setSelected(updated);
        const next = copyTask(updated);
        setEditor(next);
        setBaseline(next);
      }
      setTasks(current => sortLifeTasks([
        ...current.map(item => item.id === task.id ? updated : item),
        ...(nextOccurrence && !current.some(item => item.id === nextOccurrence.id) ? [nextOccurrence] : []),
      ]));
      setNotice(nextOccurrence ? `Task completed. Next occurrence scheduled for ${formatDate(nextOccurrence.due_date)}.` : 'Task status updated.');
    } catch (updateError) {
      if (ownerId !== ownerRef.current) return;
      setError(updateError?.code === 'ENTITY_CONFLICT' ? 'This task changed elsewhere. Reload before updating it.' : updateError?.message || 'Task status could not be updated.');
    }
  };

  const projectNames = useMemo(() => new Map(projects.map(project => [project.id, project.title || 'Untitled project'])), [projects]);

  return (
    <div className="eylo-page max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eylo-eyebrow">Personal organization</p>
          <h1 className="eylo-page-heading">Life</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Keep personal and research tasks together, with real due dates, priorities and project links.</p>
        </div>
        <div className="flex gap-2"><Link to="/life/goals" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Goals & milestones</Link><Link to="/habits" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Habits</Link><button type="button" onClick={resetEditor} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus size={16} aria-hidden="true" /> New task</button></div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Task summary">
        {[
          { label: 'Open tasks', value: counts.open, Icon: Circle },
          { label: 'Due today', value: counts.dueToday, Icon: CalendarDays },
          { label: 'Overdue', value: counts.overdue, Icon: Clock3 },
          { label: 'Completed', value: counts.done, Icon: Check },
        ].map(({ label, value, Icon }) => <div key={label} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={14} aria-hidden="true" />{label}</div><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>)}
      </div>

      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Reload</button></div>}
      {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="life-tasks-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="life-tasks-heading" className="text-sm font-semibold">Tasks <span className="font-normal text-muted-foreground">({visibleTasks.length})</span></h2>
            <label className="sr-only" htmlFor="life-task-filter">Filter tasks</label>
            <select id="life-task-filter" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-9 rounded-lg border border-border bg-background px-3 text-xs"><option value="open">Open tasks</option><option value="all">All tasks</option><option value="overdue">Overdue</option><option value="done">Completed</option></select>
          </div>
          {loading ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading tasks…</p>
            : visibleTasks.length ? <ul className="space-y-2">{visibleTasks.map(task => <li key={task.id} className={`rounded-lg border px-3 py-3 ${selected?.id === task.id ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => void cycleStatus(task)} aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`} className={`mt-0.5 rounded-full ${task.status === 'done' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}><Check size={18} aria-hidden="true" /></button>
                <button type="button" onClick={() => chooseTask(task)} className="min-w-0 flex-1 text-left"><span className={`block truncate text-sm font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{task.title}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>{formatDate(task.due_date)}</span><span>{task.priority} priority</span>{task.area !== 'personal' && <span>{task.area}</span>}{task.course && <span>{task.course}</span>}{task.project_id && <span>{projectNames.get(task.project_id) || task.project_title || 'Linked project'}</span>}</span></button>
              </div>
            </li>)}</ul>
              : <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center"><p className="text-sm font-medium">{filter === 'overdue' ? 'No overdue tasks' : filter === 'done' ? 'No completed tasks' : 'No tasks yet'}</p><p className="mt-1 text-xs text-muted-foreground">Create a task to start tracking your work.</p><button type="button" onClick={resetEditor} className="mt-3 text-xs font-semibold text-primary underline">Create a task</button></div>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Task editor">
          <form onSubmit={saveTask}>
            <fieldset disabled={saving || loadingTarget} className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{selected ? 'Edit task' : 'New task'}</h2><div className="flex gap-2">{selected && <button type="button" onClick={() => void deleteTask()} aria-label="Delete task" className="grid min-h-9 w-9 place-items-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5"><Trash2 size={15} /></button>}<button type="submit" disabled={saving || (!dirty && Boolean(selected))} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={14} aria-hidden="true" />{saving ? 'Saving…' : 'Save task'}</button></div></div>
            <label htmlFor="life-task-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">Task title</label>
            <input id="life-task-title" required maxLength={160} value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} placeholder="What needs to get done?" className="mb-4 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
            <label htmlFor="life-task-description" className="mb-1.5 block text-xs font-medium text-muted-foreground">Details</label>
            <textarea id="life-task-description" maxLength={5000} rows={4} value={editor.description} onChange={event => setEditor(current => ({ ...current, description: event.target.value }))} placeholder="Add useful context…" className="mb-4 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">Status<select value={editor.status} onChange={event => setEditor(current => ({ ...current, status: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>
              <label className="text-xs font-medium text-muted-foreground">Priority<select value={editor.priority} onChange={event => setEditor(current => ({ ...current, priority: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              <label className="text-xs font-medium text-muted-foreground">Area<select value={editor.area} onChange={event => setEditor(current => ({ ...current, area: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="personal">Personal</option><option value="research">Research</option><option value="study">Study</option><option value="work">Work</option></select></label>
              {editor.area === 'personal' && <label className="text-xs font-medium text-muted-foreground">Type<select value={editor.kind === 'habit' ? 'habit' : 'task'} onChange={event => setEditor(current => ({ ...current, kind: event.target.value, recurrence: event.target.value === 'habit' && !['daily', 'weekly'].includes(current.recurrence) ? 'daily' : current.recurrence }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="task">Task</option><option value="habit">Habit</option></select></label>}
              {editor.area === 'study' && <><label className="text-xs font-medium text-muted-foreground">Study item type<select value={editor.kind} onChange={event => setEditor(current => ({ ...current, kind: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="study">Study session</option><option value="syllabus">Syllabus item</option><option value="exam">Examination</option><option value="task">Other study task</option></select></label><label className="text-xs font-medium text-muted-foreground">Course<input maxLength={160} value={editor.course} onChange={event => setEditor(current => ({ ...current, course: event.target.value }))} placeholder="Course or subject" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><label className="text-xs font-medium text-muted-foreground sm:col-span-2">Syllabus section or learning objective<input maxLength={200} value={editor.syllabus_item} onChange={event => setEditor(current => ({ ...current, syllabus_item: event.target.value }))} placeholder="Unit, chapter, or objective" className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label></>}
              <label className="text-xs font-medium text-muted-foreground">Repeat<select value={editor.recurrence} onChange={event => setEditor(current => ({ ...current, recurrence: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">{editor.kind !== 'habit' && <option value="none">Does not repeat</option>}<option value="daily">Every day</option><option value="weekly">Every week</option>{editor.kind !== 'habit' && <option value="monthly">Every month</option>}</select></label>
              <label className="text-xs font-medium text-muted-foreground">Due date<input type="date" value={editor.due_date} onChange={event => setEditor(current => ({ ...current, due_date: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
              <label className="text-xs font-medium text-muted-foreground">Project link<select value={editor.project_id} onChange={event => setEditor(current => ({ ...current, project_id: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}</select></label>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">Private to your account. Save uses a conflict check to protect edits made in another tab.</p>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}

