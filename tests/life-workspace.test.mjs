import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isOverdueLifeTask, lifeGoalProgress, nextLifeTaskDate, normalizeLifeGoal, normalizeLifeTask, sortLifeTasks,
} from '../src/lib/life-domain.mjs';

const migration = readFileSync(new URL('../supabase/migrations/20261112161818_eylo_life_tasks.sql', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/Life.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const goalMigration = readFileSync(new URL('../supabase/migrations/20261112163010_eylo_life_goals_milestones.sql', import.meta.url), 'utf8');
const goalsPage = readFileSync(new URL('../src/pages/LifeGoals.jsx', import.meta.url), 'utf8');

test('Life task normalization validates fields and preserves allowed states', () => {
  assert.deepEqual(normalizeLifeTask({
    title: '  Submit paper  ', description: 'Final review', status: 'in_progress', priority: 'urgent', recurrence: 'weekly', due_date: '2026-12-03', project_id: '',
  }), {
    title: 'Submit paper', description: 'Final review', status: 'in_progress', priority: 'urgent', recurrence: 'weekly', due_date: '2026-12-03', project_id: null,
  });
  assert.throws(() => normalizeLifeTask({ title: ' ' }), error => error.code === 'LIFE_TASK_VALIDATION');
  assert.throws(() => normalizeLifeTask({ title: 'x'.repeat(161) }), error => error.code === 'LIFE_TASK_VALIDATION');
  assert.throws(() => normalizeLifeTask({ title: 'Valid', due_date: '2026-02-31' }), error => error.code === 'LIFE_TASK_VALIDATION');
  assert.throws(() => normalizeLifeTask({ title: 'Valid', due_date: 'yesterday' }), error => error.code === 'LIFE_TASK_VALIDATION');
  assert.throws(() => normalizeLifeTask({ title: 'Valid', recurrence: 'monthly' }), error => error.code === 'LIFE_TASK_VALIDATION');
});

test('overdue excludes completed tasks and task ordering prioritizes due date and urgency', () => {
  assert.equal(isOverdueLifeTask({ status: 'todo', due_date: '2026-11-11' }, '2026-11-12'), true);
  assert.equal(isOverdueLifeTask({ status: 'done', due_date: '2026-11-11' }, '2026-11-12'), false);
  const sorted = sortLifeTasks([
    { id: 'later', title: 'Later', status: 'todo', priority: 'urgent', due_date: '2026-12-01' },
    { id: 'normal', title: 'Normal', status: 'todo', priority: 'normal', due_date: '2026-11-15' },
    { id: 'urgent', title: 'Urgent', status: 'todo', priority: 'urgent', due_date: '2026-11-15' },
  ]);
  assert.deepEqual(sorted.map(task => task.id), ['urgent', 'normal', 'later']);
});

test('recurring tasks calculate daily, weekly and month-end dates without overflow', () => {
  assert.equal(nextLifeTaskDate('2026-11-12', 'daily'), '2026-11-13');
  assert.equal(nextLifeTaskDate('2026-11-12', 'weekly'), '2026-11-19');
  assert.equal(nextLifeTaskDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextLifeTaskDate('2028-01-31', 'monthly'), '2028-02-29');
});

test('goal milestones are validated and progress reflects completed milestones only', () => {
  const goal = normalizeLifeGoal({
    title: 'Complete pilot', status: 'active', target_date: '2027-03-15', milestones: [
      { id: '0f034b46-27ef-4c43-9873-678ed7264e45', title: 'Finish protocol', complete: true },
      { id: '4b1a5ff4-718d-43d2-9015-2b3e6b39a55d', title: 'Recruit participants', complete: false, due_date: '2027-02-01' },
    ],
  });
  assert.equal(lifeGoalProgress(goal), 50);
  assert.equal(lifeGoalProgress({ milestones: [] }), 0);
  assert.throws(() => normalizeLifeGoal({ title: ' ', milestones: [] }), error => error.code === 'LIFE_GOAL_VALIDATION');
  assert.throws(() => normalizeLifeGoal({ title: 'Goal', milestones: [{ id: 'bad', title: 'Step' }] }), error => error.code === 'LIFE_GOAL_VALIDATION');
  assert.throws(() => normalizeLifeGoal({ title: 'Goal', milestones: [
    { id: '0f034b46-27ef-4c43-9873-678ed7264e45', title: 'Step', complete: 'yes' },
  ] }), error => error.code === 'LIFE_GOAL_VALIDATION');
});

test('Life task data is private, owner validated and linked only to owned projects', () => {
  assert.match(migration, /alter table public\.life_tasks enable row level security/i);
  assert.match(migration, /\(select auth\.uid\(\)\) is distinct from new\.user_id/i);
  assert.match(migration, /p\.id = project_text::uuid and p\.user_id = new\.user_id/i);
  assert.match(migration, /create trigger projects_unlink_deleted_life_tasks after delete on public\.projects/i);
  assert.match(migration, /grant select, insert, update, delete on public\.life_tasks to authenticated/i);
  assert.match(migration, /life_tasks_recurrence_instance_idx/i);
  assert.match(migration, /recurring tasks require a due date/i);
  assert.match(repository, /LifeTask: \{ table: 'life_tasks' \}/);
});

test('goal and milestone persistence is owner scoped and validates bounded milestone data', () => {
  assert.match(goalMigration, /alter table public\.life_goals enable row level security/i);
  assert.match(goalMigration, /\(select auth\.uid\(\)\) is distinct from new\.user_id/i);
  assert.match(goalMigration, /jsonb_array_length\(new\.data -> 'milestones'\) > 50/i);
  assert.match(goalMigration, /p\.id = project_text::uuid and p\.user_id = new\.user_id/i);
  assert.match(repository, /LifeGoal: \{ table: 'life_goals' \}/);
  assert.match(goalsPage, /base44\.entities\.LifeGoal\.create/);
  assert.match(goalsPage, /base44\.entities\.LifeGoal\.updateIfUnchanged/);
  assert.match(goalsPage, /base44\.entities\.LifeGoal\.delete/);
  assert.match(goalsPage, /Progress is calculated from completed milestones/);
  assert.match(goalsPage, /ownerRef\.current = user\?\.id \|\| null/);
});

test('Life workspace supports real saved CRUD, status updates and protected navigation', () => {
  assert.match(page, /base44\.entities\.LifeTask\.create/);
  assert.match(page, /base44\.entities\.LifeTask\.updateIfUnchanged/);
  assert.match(page, /base44\.entities\.LifeTask\.delete/);
  assert.match(page, /cycleStatus/);
  assert.match(page, /nextLifeTaskDate/);
  assert.match(page, /Repeat/);
  assert.match(page, /Project link/);
  assert.match(page, /ownerRef\.current = user\?\.id \|\| null/);
  assert.match(app, /path="\/life" element=\{<Life \/>\}/);
  assert.match(app, /path="\/life\/goals" element=\{<LifeGoals \/>\}/);
  assert.match(layout, /path: '\/life'/);
  assert.match(layout, /path: '\/life\/goals'/);
});
