import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProjectTasks, toggleProjectTask } from '../src/lib/project-tasks.js';

test('project task parser reads plain, numbered, and checkbox list lines', () => {
  assert.deepEqual(parseProjectTasks('- Draft protocol\n2. Recruit participants\n- [x] Review criteria\n'), [
    { lineIndex: 0, text: 'Draft protocol', completed: false },
    { lineIndex: 1, text: 'Recruit participants', completed: false },
    { lineIndex: 2, text: 'Review criteria', completed: true },
  ]);
});

test('toggling a project task preserves surrounding lines and checkbox state', () => {
  const before = '- Draft protocol\n\n- [x] Review criteria';
  const checked = toggleProjectTask(before, 0);
  assert.equal(checked, '- [x] Draft protocol\n\n- [x] Review criteria');
  assert.equal(toggleProjectTask(checked, 0), '- [ ] Draft protocol\n\n- [x] Review criteria');
});

test('out of range task indexes leave the project task text unchanged', () => {
  assert.equal(toggleProjectTask('- Draft protocol', 4), '- Draft protocol');
});
