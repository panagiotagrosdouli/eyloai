import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeTaskAutomations } from '../src/lib/task-automation-overview.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const workflow = (n, title = 'Read papers') => ({ version: 1, id: id(n), title, steps: 'Read papers\n\nDraft methods' });

test('groups manual workflow definitions and confirmed runs by project', () => {
  const output = summarizeTaskAutomations([
    { id: id(1), title: 'Research A', product_workbench: { workflows: {version: 1, records: [workflow(11)]}}, product_workflow_runs: [{id: id(21), created_at:'2026-11-16T10:00:00Z', task_ids:[id(31),id(32)]}] },
    { id: id(2), title: 'Empty project' },
    { id: id(3), title: 'History only', product_workflow_runs: [{id: id(23), created_at:'2026-11-15T12:00:00Z', task_ids:[id(33)]}] },
  ]);
  assert.equal(output.totalWorkflows, 1);
  assert.equal(output.visibleRuns, 2);
  assert.equal(output.projects.length, 2);
  assert.deepEqual(output.projects[0].workflows[0].steps, ['Read papers','Draft methods']);
  assert.equal(output.projects[0].runs[0].taskCount, 2);
  assert.equal(output.truncated, false);
});

test('one invalid workflow record does not hide valid projects or fabricate runs', () => {
  const output = summarizeTaskAutomations([
    { id: id(1), title: 'Invalid', product_workbench: { workflows: { version: 1, records: [{title:'no id'}] }} },
    { id: id(2), title: 'Valid', product_workbench: { workflows: { version: 1, records: [workflow(12)]}} },
    { id: 'not-a-project-id', title:'Injected', product_workbench: { workflows: { version: 1, records: [workflow(13)]}} },
  ]);
  assert.equal(output.unreadableProjects, 1);
  assert.equal(output.totalWorkflows, 1);
  assert.deepEqual(output.projects.map(x => x.title), ['Invalid','Valid']);
  assert.equal(output.projects[0].error.length > 0, true);
});

test('malformed confirmed runs are not represented as successful runs', () => {
  const output = summarizeTaskAutomations([{
    id: id(1), title:'Cases',
    product_workflow_runs: [
      { id:'fake', created_at:'2026-11-15T12:00:00Z', task_ids:['a'] },
      { id:id(23), created_at:'not a date', task_ids:['a'] },
      { id:id(24), created_at:'2026-11-15T12:00:00Z' },
    ],
  }]);
  assert.equal(output.visibleRuns, 0);
  assert.equal(output.projects.length, 0);
  assert.throws(() => summarizeTaskAutomations(null), /unavailable/);
});

test('do not count malformed, duplicate or empty task IDs as confirmed execution', () => {
  const output = summarizeTaskAutomations([{
    id: id(1), title: 'Research',
    product_workflow_runs: [
      { id: id(11), created_at: '2026-11-17T09:00:00Z', task_ids: [] },
      { id: id(12), created_at: '2026-11-17T09:01:00Z', task_ids: ['not-a-task'] },
      { id: id(13), created_at: '2026-11-17T09:02:00Z', task_ids: [id(30), id(30)] },
      { id: id(14), created_at: '2026-11-17T09:03:00Z', task_ids: [id(31)] },
    ],
  }]);
  assert.equal(output.visibleRuns, 1);
  assert.equal(output.projects[0].runs[0].id, id(14));
});

test('signed-out state can display its error rather than an endless spinner', () => {
  const page = readFileSync(new URL('../src/pages/TaskAutomations.jsx', import.meta.url), 'utf8');
  assert.match(page, /const ownerId = user\?\.id \?\? null;/);
});

test('task automations route exposes the actual hub, never a silent project chooser redirect', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url),'utf8');
  const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url),'utf8');
  const page = readFileSync(new URL('../src/pages/TaskAutomations.jsx', import.meta.url),'utf8');
  assert.match(app, /path="\/automations" element={<TaskAutomations \/>}/);
  assert.match(app, /const TaskAutomations = lazy/);
  assert.match(layout, /label: 'Task automations', path: '\/automations'/);
  assert.match(page, /getUsableSession\(\{ required: true, validate: true \}\)/);
  assert.match(page, /workbench\/workflows/);
  assert.match(page, /manual workflows/);
});
