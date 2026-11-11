import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('project planner only adds reviewed draft tasks after user acceptance', () => {
  assert.match(source, /Generate editable plan draft/);
  assert.match(source, /setPlannerDraft\(buildProjectPlanDraft\(editing\.milestones, editing\.tasks\)\)/);
  assert.match(source, /Accept into task editor/);
  assert.match(source, /acceptProjectPlanDraft\(editing\.tasks, plannerDraft\)/);
  assert.match(source, /setEditing\(previous => \(\{ \.\.\.previous, tasks: accepted \}\)\)/);
});

test('planner explicitly distinguishes local draft from persisted project save', () => {
  assert.match(source, /are not saved yet\. Click Save/);
  assert.match(source, /Nothing is added automatically/);
  assert.match(source, /Discard draft/);
  assert.match(source, /onClick=\{saveProject\}/);
});
