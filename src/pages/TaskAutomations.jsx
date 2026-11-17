import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getUsableSession } from '@/lib/supabaseClient';
import { summarizeTaskAutomations } from '@/lib/task-automation-overview.mjs';

export default function TaskAutomations() {
  const { user } = useAuth();
  const ownerId = user?.id;
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState({ ownerId: null, loading: true, data: null, error: '' });
  useEffect(() => {
    let cancelled = false;
    setView({ ownerId, loading: true, data: null, error: '' });
    if (!ownerId) {
      setView({ ownerId: null, loading: false, data: null, error: 'Sign in to view your saved workflows.' });
      return () => { cancelled = true; };
    }
    void (async () => {
      try {
        const session = await getUsableSession({ required: true, validate: true });
        if (session.user.id !== ownerId) throw new Error('Your account changed. Reload your workspace.');
        const projects = await base44.entities.Project.list('-updated_date', 1000);
        const current = await getUsableSession({ required: true, validate: true });
        if (current.user.id !== ownerId) throw new Error('Your account changed. Reload your workspace.');
        if (!cancelled) setView({ ownerId, loading: false, data: summarizeTaskAutomations(projects), error: '' });
      } catch (failure) {
        if (!cancelled) setView({ ownerId, loading: false, data: null, error: failure?.message || 'Workflows could not be loaded.' });
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId, revision]);

  const data = view.ownerId === ownerId ? view.data : null;
  const loading = view.ownerId !== ownerId || view.loading;
  return <main className="eylo-page mx-auto max-w-5xl space-y-5">
    <header className="space-y-2">
      <p className="eylo-eyebrow">Private workspace</p>
      <h1 className="eylo-page-heading">Task automations</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Review workflow definitions saved inside your projects and previously confirmed task-creation runs. These are <strong>manual workflows</strong>, not recurring background schedules. Running one requires an explicit confirmation in its project workspace.</p>
    </header>
    <nav className="flex flex-wrap items-center gap-3">
      <Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary" to="/projects">My projects</Link>
      <button type="button" className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh saved workflows</button>
    </nav>
    {loading && <p role="status" className="rounded-xl border border-border p-5">Loading your saved workflows…</p>}
    {!loading && view.error && <div role="alert" className="rounded-xl border border-destructive/50 p-5 text-sm"><p>{view.error}</p><button type="button" className="mt-3 underline" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {!loading && data && <>
      <div className="flex flex-wrap gap-3 text-sm" aria-label="Saved workflow totals">
        <span className="rounded-lg border border-border px-4 py-3"><strong>{data.totalWorkflows}</strong> saved workflow definitions</span>
        <span className="rounded-lg border border-border px-4 py-3"><strong>{data.visibleRuns}</strong> displayed confirmed runs</span>
        <span className="rounded-lg border border-border px-4 py-3"><strong>{data.projects.length}</strong> projects with workflow history</span>
      </div>
      {data.truncated && <p role="status" className="text-sm text-muted-foreground">Only the 1,000 most recently updated projects were inspected. Older projects may not appear.</p>}
      {data.unreadableProjects > 0 && <p role="alert" className="text-sm text-destructive">{data.unreadableProjects} project(s) contain invalid workflow records. Open the affected project to review them.</p>}
      {data.projects.length === 0 && <section className="rounded-xl border border-dashed border-border p-8">
        <h2 className="font-semibold">No saved task workflows yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">Open an existing project, choose Workflow Builder, add task steps and explicitly save them. A confirmed run requires a working task service; if it is not configured, execution may be unavailable. This page only displays saved definitions and recorded runs.</p>
        <Link className="mt-4 inline-flex min-h-11 items-center text-primary underline" to="/projects">Choose a project</Link>
      </section>}
      <div className="space-y-4">
        {data.projects.map(project => <section key={project.id} className="rounded-xl border border-border bg-card p-5" aria-label={project.title}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{project.title}</h2>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-secondary" to={`/projects/${project.id}/workbench/workflows`}>Open Workflow Builder</Link>
          </div>
          {project.error && <p className="mt-3 text-sm text-destructive">{project.error}</p>}
          {project.workflows.map(workflow => <article key={workflow.id} className="mt-4 rounded-lg bg-secondary/50 p-4">
            <h3 className="font-semibold">{workflow.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{workflow.steps.length} task steps · Saved definition; not automatically scheduled</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">{workflow.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          </article>)}
          {project.runs.length > 0 && <div className="mt-4">
            <h3 className="text-sm font-semibold">Confirmed runs (latest first)</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{project.runs.map(run => <li key={run.id}>{new Date(run.createdAt).toLocaleString()} · {run.taskCount} created tasks · Run {run.id}</li>)}</ul>
            <Link className="mt-2 inline-flex min-h-11 items-center text-primary underline" to="/life">Review created tasks in Life</Link>
          </div>}
        </section>)}
      </div>
    </>}
  </main>;
}
