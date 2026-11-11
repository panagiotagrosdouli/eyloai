import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gapFinder = readFileSync(new URL('../src/pages/ResearchGaps.jsx', import.meta.url), 'utf8');
const project = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');
const candidateReview = readFileSync(new URL('../src/components/projects/GapCandidateReviewItem.jsx', import.meta.url), 'utf8');

test('saving candidates requires explicit existing project selection and current evidence', () => {
  assert.match(gapFinder, /if \(!projectId\)/);
  assert.match(gapFinder, /gapsContextKey !== currentEvidenceContextKey/);
  assert.match(gapFinder, /saveResearchGapCandidate\(/);
  assert.match(gapFinder, /Save candidate to selected project/);
});

test('saved candidate appears in Project Evidence with supporting and contrary sources', () => {
  assert.match(project, /Saved candidate research questions/);
  assert.match(candidateReview, /candidate\.supporting_papers/);
  assert.match(candidateReview, /candidate\.counterevidence_papers/);
  assert.match(candidateReview, /Human assessment, not a verified literature gap/);
  assert.match(project, /not established gaps/);
  assert.match(project, /<GapCandidateReviewItem/);
});

test('gap source cards do not link unsafe URLs as executable browser hrefs', () => {
  assert.match(gapFinder, /isSafeLiteratureSourceUrl\(sourcePaper\.url\)/);
  assert.match(gapFinder, /isSafeLiteratureSourceUrl\(paper\.url\)/);
});
