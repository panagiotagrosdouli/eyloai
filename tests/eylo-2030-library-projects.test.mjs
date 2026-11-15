import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const library = readFileSync(new URL('../src/pages/Library.jsx', import.meta.url), 'utf8');
const projects = readFileSync(new URL('../src/pages/Projects.jsx', import.meta.url), 'utf8');

test('Library offers the right next step without mistaking a search miss for empty saved work', () => {
  for (const fragment of ['No matching papers', 'No matching researchers', 'No matching opportunities', 'No saved papers yet', 'Clear search', 'Find publications', 'Find funding']) {
    assert.ok(library.includes(fragment), 'missing library guidance: ' + fragment);
  }
  assert.ok(library.includes('href="/opportunities"'));
  assert.ok(library.includes('href="/search"'));
});
test('Library search and source actions have accessible names', () => {
  for (const fragment of ['htmlFor="library-search"', 'id="library-search"', 'aria-pressed={tab === t.key}', 'Open source for', 'Open researcher profile for', 'role="status" aria-live="polite"']) {
    assert.ok(library.includes(fragment), 'missing library accessibility feature: ' + fragment);
  }
});
test('Project creation has field labels and preserves creation action', () => {
  for (const id of ['new-project-title','new-project-goal','new-project-milestones','new-project-tasks']) {
    assert.ok(projects.includes('htmlFor="' + id + '"'));
    assert.ok(projects.includes('id="' + id + '"'));
  }
  assert.ok(projects.includes('aria-label="Close new project form"'));
  assert.ok(projects.includes('onClick={createProject}'));
});
