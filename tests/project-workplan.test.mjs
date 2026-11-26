import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartWorkplanTask, getWorkplanProgress, normalizeWorkplan, validateWorkplan } from '../src/lib/project-workplan.mjs';

const items = [
  { id: 'protocol', title: 'Approve protocol', status: 'done', due_date: '2026-12-01' },
  { id: 'collect', title: 'Collect data', status: 'in_progress', depends_on: ['protocol'], deliverable: 'De-identified dataset' },
];

test('workplan normalization preserves valid user fields and discards malformed rows safely', () => {
  assert.deepEqual(normalizeWorkplan([
    ...items,
    { id: 'collect', title: 'Duplicate id' },
    null,
    { id: 'bad', title: 'Bad date', due_date: '2026-02-30', status: 'future' },
  ]), [
    { id: 'protocol', title: 'Approve protocol', phase: '', deliverable: '', due_date: '2026-12-01', status: 'done', depends_on: [], risk: '', researcher_notes: '', evidence_summary: '', evidence_kind: 'none', source_ids: [] },
    { id: 'collect', title: 'Collect data', phase: '', deliverable: 'De-identified dataset', due_date: '', status: 'in_progress', depends_on: ['protocol'], risk: '', researcher_notes: '', evidence_summary: '', evidence_kind: 'none', source_ids: [] },
    { id: 'bad', title: 'Bad date', phase: '', deliverable: '', due_date: '', status: 'todo', depends_on: [], risk: '', researcher_notes: '', evidence_summary: '', evidence_kind: 'none', source_ids: [] },
  ]);
});

test('workplan accepts valid dependencies, but rejects missing references and cycles', () => {
  assert.equal(validateWorkplan(items).valid, true);
  assert.equal(validateWorkplan([{ id: 'a', title: 'A', depends_on: ['missing'] }]).valid, false);
  assert.match(validateWorkplan([{ id: 'a', title: 'A', depends_on: ['a'] }]).message, /itself/i);
  assert.match(validateWorkplan([
    { id: 'a', title: 'A', depends_on: ['b'] },
    { id: 'b', title: 'B', depends_on: ['a'] },
  ]).message, /cycle/i);
  assert.match(validateWorkplan([{ id: 'a', title: 'A', due_date: '2026-02-30' }]).message, /valid calendar dates/i);
  assert.equal(validateWorkplan([{ id: 'a', title: 'A', due_date: '' }]).valid, true);
});

test('progress reflects only completed tasks and prerequisites reflect dependency status', () => {
  assert.deepEqual(getWorkplanProgress(items), { total: 2, done: 1, percent: 50 });
  assert.equal(canStartWorkplanTask(items[1], items), true);
  assert.equal(canStartWorkplanTask(items[1], [{ ...items[0], status: 'in_progress' }, items[1]]), false);
  const reopenedPrerequisite = [{ ...items[0], status: 'todo' }, { ...items[1], status: 'done' }];
  assert.equal(canStartWorkplanTask(reopenedPrerequisite[1], reopenedPrerequisite), false);
  assert.match(validateWorkplan(reopenedPrerequisite).message, /prerequisites completed/i);
  assert.equal(validateWorkplan([{ ...items[0], status: 'todo' }, { ...items[1], status: 'blocked' }]).valid, true,
    'a task may be explicitly blocked while waiting for an unfinished prerequisite');
  assert.deepEqual(getWorkplanProgress([]), { total: 0, done: 0, percent: 0 });
});

test('workplan rejects empty titles, duplicate identifiers and more than 100 tasks', () => {
  assert.equal(validateWorkplan([{ id: 'a', title: ' ' }]).valid, false);
  assert.equal(validateWorkplan([{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }]).valid, false);
  const tooMany = Array.from({ length: 101 }, (_, index) => ({ id: `t${index}`, title: `Task ${index}` }));
  assert.equal(validateWorkplan(tooMany).valid, false);
});
