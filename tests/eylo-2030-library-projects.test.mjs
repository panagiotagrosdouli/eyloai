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

test('Funding search does not depend on a fixed-width overlaid submit button', () => {
  const funding = readFileSync(new URL('../src/pages/Opportunities.jsx', import.meta.url), 'utf8');
  assert.ok(funding.includes('htmlFor="funding-query"'));
  assert.ok(funding.includes('id="funding-query"'));
  assert.ok(funding.includes('Find funding'));
  assert.ok(funding.includes('className="mb-4 flex max-w-2xl flex-col gap-3 sm:flex-row'));
  assert.ok(funding.includes('aria-busy={loading}'));
});
test('Research gap workflow documents the evidence threshold and preserves saving behavior', () => {
  const gaps = readFileSync(new URL('../src/pages/ResearchGaps.jsx', import.meta.url), 'utf8');
  assert.ok(gaps.includes('Select at least two saved publications'));
  assert.ok(gaps.includes('Find publications'));
  assert.ok(gaps.includes('onClick={() => saveDiscoveredPaper(paper)}'));
  assert.ok(gaps.includes('Create project from this gap'));
});
