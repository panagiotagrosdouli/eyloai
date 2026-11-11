import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gapFinder = readFileSync(new URL('../src/pages/ResearchGaps.jsx', import.meta.url), 'utf8');
const project = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('saving candidates requires explicit existing project selection and current evidence', () => {
  assert.match(gapFinder, /if \(!projectId\)/);
  assert.match(gapFinder, /gapsContextKey !== currentEvidenceContextKey/);
  assert.match(gapFinder, /saveResearchGapCandidate\(/);
  assert.match(gapFinder, /Save candidate to selected project/);
});

test('saved candidate appears in Project Evidence with supporting and contrary sources', () => {
  assert.match(project, /Saved candidate research questions/);
  assert.match(project, /candidate\.supporting_papers/);
  assert.match(project, /candidate\.counterevidence_papers/);
  assert.match(project, /candidate awaiting researcher review/);
  assert.match(project, /not established gaps/);
});
