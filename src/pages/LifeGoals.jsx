import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Plus, Save, Target, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { lifeGoalProgress, normalizeLifeGoal } from '@/lib/life-domain.mjs';

const EMPTY_GOAL = { title: '', description: '', status: 'active', target_date: '', project_id: '', milestones: [] };
const copyGoal = goal => ({ ...EMPTY_GOAL, ...(goal || {}), target_date: goal?.target_date || '', project_id: goal?.project_id || '', milestones: Array.isArray(goal?.milestones) ? goal.milestones.map(item => ({ ...item })) : [] });
const sameGoal = (left, right) => JSON.stringify(copyGoal(left)) === JSON.stringify(copyGoal(right));

function dateLabel(value) {
  if (!value) return 'No target date';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function LifeGoals() {
  const { user } = useAuth();
  const ownerRef = useRef(user?.id || null);
  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(EMPTY_GOAL);
  const [baseline, setBaseline] = useState(EMPTY_GOAL);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !sameGoal(editor, baseline);

  const load = async (ownerId = ownerRef.current) => {
    if (!ownerId || ownerId !== ownerRef.current) return;
    setLoading(true);
    setError('');
    const [goalResult, projectResult] = await Promise.allSettled([
      base44.entities.LifeGoal.list('-updated_date', 1000),
      base44.entities.Project.list('-updated_date', 1000),
    ]);
    if (ownerId !== ownerRef.current) return;
    if (goalResult.status === 'fulfilled') setGoals([...goalResult.value].sort((a, b) => String(a.target_date || '9999-12-31').localeCompare(String(b.target_date || '9999-12-31'))));
    else setError('Goals could not be loaded. Check your connection and retry.');
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    else setNotice('Projects could not be loaded. Goals remain available without project links.');
    setLoading(false);
  };

  useEffect(() => {
    ownerRef.current = user?.id || null;
    setGoals([]);
    setProjects([]);
    setSelected(null);
    setEditor(EMPTY_GOAL);
    setBaseline(EMPTY_GOAL);
    setMilestoneTitle('');
    setMilestoneDate('');
    setError('');
    setNotice('');
    if (user?.id) void load(user.id);
    else setLoading(false);
  }, [user?.id]);

  const projectNames = useMemo(() => new Map(projects.map(project => [project.id, project.title || 'Untitled project'])), [projects]);
  const resetEditor = () => {
    setSelected(null);
    setEditor(EMPTY_GOAL);
    setBaseline(EMPTY_GOAL);
    setError('');
    setNotice('New goal. Add milestones to track measurable progress.');
  };

  const chooseGoal = goal => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const next = copyGoal(goal);
    setSelected(goal);
    setEditor(next);
    setBaseline(next);
    setError('');
    setNotice('');
  };

  const saveGoal = async event => {
    event.preventDefault();
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = normalizeLifeGoal(editor);
      const project = projects.find(item => item.id === payload.project_id);
      const savePayload = { ...payload, project_title: project?.title || (payload.project_id === selected?.project_id ? selected?.project_title : '') || '' };
      const saved = selected
        ? await base44.entities.LifeGoal.updateIfUnchanged(selected.id, savePayload, selected.updated_date)
        : await base44.entities.LifeGoal.create(savePayload);
      if (ownerId !== ownerRef.current) return;
      setSelected(saved);
      setEditor(copyGoal(saved));
      setBaseline(copyGoal(saved));
      setGoals(current => [...current.filter(goal => goal.id !== saved.id), saved].sort((a, b) => String(a.target_date || '9999-12-31').localeCompare(String(b.target_date || '9999-12-31'))));
      setNotice('Goal saved. Progress is calculated from completed milestones.');
    } catch (saveError) {
      if (ownerId !== ownerRef.current) return;
      setError(saveError?.code === 'ENTITY_CONFLICT'
        ? 'This goal changed in another tab. Reload the latest version before saving.'
        : saveError?.message || 'The goal could not be saved. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async () => {
    if (!selected || !window.confirm('Delete this goal and its milestones?')) return;
    const ownerId = ownerRef.current;
    if (!ownerId) return;
    try {
      await base44.entities.LifeGoal.delete(selected.id);
      if (ownerId !== ownerRef.current) return;
      setGoals(current => current.filter(goal => goal.id !== selected.id));
      resetEditor();
      setNotice('Goal deleted.');
    } catch (deleteError) {
      if (ownerId === ownerRef.current) setError(deleteError?.message || 'The goal could not be deleted. Retry in a moment.');
    }
  };

  const addMilestone = () => {
    const title = milestoneTitle.trim();
    if (!title) return;
    if (editor.milestones.length >= 50) {
      setError('A goal can have at most 50 milestones.');
      return;
    }
    setEditor(current => ({
      ...current,
      milestones: [...current.milestones, {
        id: crypto.randomUUID(), title, due_date: milestoneDate || null, complete: false,
      }],
    }));
    setMilestoneTitle('');
    setMilestoneDate('');
    setError('');
  };

  const toggleMilestone = milestoneId => setEditor(current => ({
    ...current,
    milestones: current.milestones.map(item => item.id === milestoneId ? { ...item, complete: !item.complete } : item),
  }));

  const removeMilestone = milestoneId => setEditor(current => ({
    ...current,
    milestones: current.milestones.filter(item => item.id !== milestoneId),
  }));

  return (
    <div className="eylo-page max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/life" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to tasks</Link>
          <p className="eylo-eyebrow">Personal organization</p>
          <h1 className="eylo-page-heading">Goals & milestones</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Set a target, add concrete milestones and track progress from completed steps.</p>
        </div>
        <button type="button" onClick={resetEditor} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus size={16} aria-hidden="true" /> New goal</button>
      </header>

      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Reload</button></div>}
      {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="life-goals-heading">
          <h2 id="life-goals-heading" className="mb-4 text-sm font-semibold">Your goals <span className="font-normal text-muted-foreground">({goals.length})</span></h2>
          {loading ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading goals…</p>
            : goals.length ? <ul className="space-y-2">{goals.map(goal => {
              const progress = lifeGoalProgress(goal);
              return <li key={goal.id} className={`rounded-lg border p-3 ${selected?.id === goal.id ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                <button type="button" onClick={() => chooseGoal(goal)} className="w-full text-left">
                  <span className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium">{goal.title}</span><span className="text-[11px] text-muted-foreground">{goal.status || 'active'}</span></span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{dateLabel(goal.target_date)} · {goal.milestones?.filter(item => item.complete).length || 0}/{goal.milestones?.length || 0} milestones</span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></span>
                  <span className="mt-1 block text-right text-[10px] tabular-nums text-muted-foreground">{progress}%</span>
                </button>
              </li>;
            })}</ul>
              : <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center"><Target size={24} aria-hidden="true" className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-medium">No goals yet</p><p className="mt-1 text-xs text-muted-foreground">Create a goal, then add milestones to measure progress.</p></div>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Goal editor">
          <form onSubmit={saveGoal}>
            <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{selected ? 'Edit goal' : 'New goal'}</h2><div className="flex gap-2">{selected && <button type="button" onClick={() => void deleteGoal()} aria-label="Delete goal" className="grid min-h-9 w-9 place-items-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5"><Trash2 size={15} /></button>}<button type="submit" disabled={saving || (!dirty && Boolean(selected))} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={14} aria-hidden="true" />{saving ? 'Saving…' : 'Save goal'}</button></div></div>
            <label htmlFor="life-goal-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">Goal</label>
            <input id="life-goal-title" required maxLength={160} value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} placeholder="What do you want to achieve?" className="mb-4 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
            <label htmlFor="life-goal-description" className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea id="life-goal-description" maxLength={5000} rows={3} value={editor.description} onChange={event => setEditor(current => ({ ...current, description: event.target.value }))} placeholder="Why this matters and what success looks like…" className="mb-4 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground" />
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">Target date<input type="date" value={editor.target_date} onChange={event => setEditor(current => ({ ...current, target_date: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
              <label className="text-xs font-medium text-muted-foreground">Status<select value={editor.status} onChange={event => setEditor(current => ({ ...current, status: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
            </div>
            <label className="mb-5 block text-xs font-medium text-muted-foreground">Project link<select value={editor.project_id} onChange={event => setEditor(current => ({ ...current, project_id: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{projectNames.get(project.id)}</option>)}</select></label>

            <div className="border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold">Milestones <span className="font-normal text-muted-foreground">({editor.milestones.length}/50)</span></h3><span className="text-[11px] text-muted-foreground">{lifeGoalProgress(editor)}% complete</span></div>
              <ul className="mb-3 space-y-2">{editor.milestones.map(milestone => <li key={milestone.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"><button type="button" onClick={() => toggleMilestone(milestone.id)} aria-label={`${milestone.complete ? 'Reopen' : 'Complete'} milestone ${milestone.title}`} aria-pressed={milestone.complete} className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${milestone.complete ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{milestone.complete && <Check size={12} />}</button><span className={`min-w-0 flex-1 text-xs ${milestone.complete ? 'text-muted-foreground line-through' : ''}`}>{milestone.title}<span className="ml-2 text-[10px] text-muted-foreground">{dateLabel(milestone.due_date)}</span></span><button type="button" onClick={() => removeMilestone(milestone.id)} aria-label={`Remove milestone ${milestone.title}`} className="text-xs text-muted-foreground hover:text-destructive">Remove</button></li>)}</ul>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"><label className="sr-only" htmlFor="life-milestone-title">Milestone title</label><input id="life-milestone-title" maxLength={160} value={milestoneTitle} onChange={event => setMilestoneTitle(event.target.value)} placeholder="Add a concrete step" className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm" /><label className="sr-only" htmlFor="life-milestone-date">Milestone date</label><input id="life-milestone-date" type="date" value={milestoneDate} onChange={event => setMilestoneDate(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-xs" /><button type="button" onClick={addMilestone} disabled={!milestoneTitle.trim() || editor.milestones.length >= 50} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50"><Plus size={14} /> Add</button></div>
              <p className="mt-3 text-[11px] text-muted-foreground">Save to persist goal and milestone edits. Progress is based only on milestones you mark complete.</p>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
