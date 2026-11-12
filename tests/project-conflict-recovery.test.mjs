import test from 'node:test';
import assert from 'node:assert/strict';
import { projectEditableValues, planProjectReconciliation, resolveProjectReconciliation } from '../src/lib/project-conflict-recovery.mjs';
import { readFileSync } from 'node:fs';

const base = { id:'owned-project', updated_date:'2026-11-12T10:00:00Z',
  title:'My project', notes:'Original notes', tasks:'- [ ] A', goal:'Original goal', description:'Research',
  milestones:'Phase 1', status:'planning' };

test('non-overlapping local and remote changes can be prepared without erasing either', () => {
  const local = { ...projectEditableValues(base), notes:'My unsaved methodology notes' };
  const remote = { ...base, updated_date:'2026-11-12T10:01:00Z', tasks:'- [x] A' };
  const plan = planProjectReconciliation(base, local, remote);
  assert.equal(plan.localChanges, 1);
  assert.equal(plan.remoteChanges, 1);
  assert.deepEqual(plan.conflicts, []);
  const merged = resolveProjectReconciliation(base, local, remote);
  assert.equal(merged.notes, 'My unsaved methodology notes');
  assert.equal(merged.tasks, '- [x] A');
  assert.equal(merged.title, 'My project');
});

test('overlapping field edits require explicit researcher choice, never silently overwrite', () => {
  const local = { ...projectEditableValues(base), notes:'Local findings' };
  const remote = { ...base, notes:'New notes from another tab', updated_date:'2026-11-12T10:05:00Z' };
  assert.deepEqual(planProjectReconciliation(base, local, remote).conflicts.map(x=>x.id), ['notes']);
  assert.throws(()=>resolveProjectReconciliation(base, local, remote), /Choose which version/);
  assert.equal(resolveProjectReconciliation(base, local, remote, { notes:'mine' }).notes, 'Local findings');
  assert.equal(resolveProjectReconciliation(base, local, remote, { notes:'latest' }).notes, 'New notes from another tab');
});

test('matching edits do not count as conflicts and unmodified fields use latest database state', () => {
  const local={...projectEditableValues(base), goal:'Updated objective'};
  const remote={...base, goal:'Updated objective', title:'Renamed by another tab'};
  const p=planProjectReconciliation(base,local,remote);
  assert.equal(p.conflicts.length,0);
  const resolved=resolveProjectReconciliation(base,local,remote);
  assert.equal(resolved.title,'Renamed by another tab');
  assert.equal(resolved.goal,'Updated objective');
});

test('cross-project reconciliation is refused and no field is silently copied', () => {
  assert.throws(()=>planProjectReconciliation(base,projectEditableValues(base),{ ...base,id:'other-project'}),/Project identity changed/);
});

test('Project Detail preserves local edits and does not save on preparation', () => {
  const source=readFileSync(new URL('../src/pages/ProjectDetail.jsx',import.meta.url),'utf8');
  assert.match(source,/error\?\.code === 'ENTITY_CONFLICT'/);
  assert.match(source,/setProjectConflict\(\{ base, latest \}\)/);
  assert.match(source,/setEditing\(localDraft\)/);
  assert.match(source,/<ProjectConflictRecovery/);
  assert.match(source,/setEditing\(merged\);\s*setProjectConflict\(null\)/);
  assert.match(source,/Draft reconciled, not saved/);
  assert.match(source,/disabled=\{saving \|\| !!projectConflict\}/);
});

test('manual per-field choices and comparison are surfaced as accessible controls', () => {
  const component=readFileSync(new URL('../src/components/projects/ProjectConflictRecovery.jsx',import.meta.url),'utf8');
  assert.match(component,/role="alert"/);
  assert.match(component,/Your unsaved draft/);
  assert.match(component,/Latest saved value/);
  assert.match(component,/type="radio"/);
  assert.match(component,/Prepare reconciled draft \(then Save\)/);
  assert.match(component,/Discard my draft and load latest/);
  assert.match(component,/Check for newer saved version/);
});
