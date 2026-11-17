import { readWorkbench } from './product-workbench.mjs';

const MAX_PROJECTS = 1000;
const MAX_RUNS_PER_PROJECT = 50;
const uuid = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function validRuns(value) {
  return (Array.isArray(value) ? value : [])
    .filter(run => run && typeof run === 'object' && uuid(run.id)
      && typeof run.created_at === 'string' && !Number.isNaN(Date.parse(run.created_at))
      && Array.isArray(run.task_ids)
      && run.task_ids.length > 0 && run.task_ids.length <= 20
      && run.task_ids.every(uuid)
      && new Set(run.task_ids).size === run.task_ids.length)
    .slice(-MAX_RUNS_PER_PROJECT)
    .map(run => ({
      id: run.id,
      createdAt: run.created_at,
      taskCount: run.task_ids.length,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Converts only owner-scoped Project rows retrieved by the authenticated
 * Project facade into a display model. Never accepts arbitrary cross-user IDs
 * from the URL, and never interprets a manual workflow as scheduled.
 */
export function summarizeTaskAutomations(projects) {
  if (!Array.isArray(projects)) throw new Error('Project list is unavailable.');
  const rows = [];
  let totalWorkflows = 0;
  let totalRuns = 0;
  let unreadableProjects = 0;
  for (const project of projects.slice(0, MAX_PROJECTS)) {
    if (!project || !uuid(project.id)) continue;
    const runs = validRuns(project.product_workflow_runs);
    let workflows = [];
    let error = '';
    try {
      workflows = readWorkbench(project, 'workflows').records.map(record => ({
        id: record.id,
        title: record.title,
        steps: record.steps.split('\n').map(step => step.trim()).filter(Boolean),
      }));
    } catch {
      error = 'Saved workflow records need review in this project.';
      unreadableProjects += 1;
    }
    if (workflows.length === 0 && runs.length === 0 && !error) continue;
    rows.push({
      id: project.id,
      title: typeof project.title === 'string' && project.title.trim() ? project.title : 'Untitled project',
      workflows,
      runs,
      error,
    });
    totalWorkflows += workflows.length;
    totalRuns += runs.length;
  }
  return {
    projects: rows,
    totalWorkflows,
    visibleRuns: totalRuns,
    unreadableProjects,
    truncated: projects.length >= MAX_PROJECTS,
  };
}
