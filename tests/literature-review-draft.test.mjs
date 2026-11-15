import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReviewEvidenceOutline } from '../src/lib/literature-review-draft.mjs';

const project = { id: 'owned-project', title: 'AI in clinical diagnosis' };
const protocol = {
  question: 'How is AI evaluated in clinical diagnosis?',
  review_type: 'scoping',
  search_databases: 'OpenAlex; PubMed',
  search_strings: 'AI AND clinical diagnosis',
  search_date: '2026-11-15',
  inclusion_criteria: 'Peer-reviewed',
  exclusion_criteria: 'No clinical validation',
  screening: [
    { paper_id: 'saved-1', decision: 'include' },
    { paper_id: 'saved-2', decision: 'exclude', reason: 'Wrong population' },
    { paper_id: 'not-in-library', decision: 'include' },
  ],
};
const papers = [
  { id: 'saved-1', title: 'Clinical AI validation', authors: 'A. Researcher', year: 2024, doi: '10.1000/1234', url: 'https://doi.org/10.1000/1234' },
  { id: 'saved-2', title: 'Excluded publication', authors: 'B. Researcher', year: 2022, url: 'https://example.org/2' },
];

test('source-linked draft contains only human-included authorized saved records', () => {
  const draft = createReviewEvidenceOutline({ project, protocol, papers });
  assert.equal(draft.includedCount, 1);
  assert.match(draft.filename, /AI in clinical diagnosis - review outline\.md$/);
  assert.match(draft.body, /Clinical AI validation/);
  assert.match(draft.body, /https:\/\/doi\.org\/10\.1000\/1234/);
  assert.match(draft.body, /AI AND clinical diagnosis/);
  assert.doesNotMatch(draft.body, /Excluded publication/);
  assert.doesNotMatch(draft.body, /not-in-library/);
  assert.match(draft.body, /not read full texts/);
  assert.match(draft.body, /Extracted findings: \*\*Not provided/);
});

test('invalid saved-paper URLs never become links in a review draft', () => {
  const draft = createReviewEvidenceOutline({
    project,
    protocol,
    papers: [{ ...papers[0], url: 'javascript:alert(1)' }],
  });
  assert.doesNotMatch(draft.body, /javascript:/);
  assert.match(draft.body, /No validated HTTP\(S\) URL available/);
});

test('missing authorized inclusion records fail closed', () => {
  assert.throws(() => createReviewEvidenceOutline({ project, protocol, papers: [] }), /Include at least one saved paper/);
  assert.throws(() => createReviewEvidenceOutline({ project: {}, protocol, papers }), /authorized research project/);
});

test('editor receives only an unsaved local handoff and requires an explicit save action', () => {
  const review = readFileSync(new URL('../src/pages/LiteratureReview.jsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/pages/DocumentEditor.jsx', import.meta.url), 'utf8');
  assert.match(review, /startEvidenceOutline/);
  assert.match(review, /hasUnsavedChanges \|\| counts\.included === 0/);
  assert.match(review, /state: \{ reviewOutline: \{ userId: user\.id/);
  assert.match(editor, /candidateOutline\.userId === user\.id/);
  assert.match(review, /loadedForUserId !== user\.id/);
  assert.match(review, /\[attempt, preferredProjectId, user\?\.id\]/);
  assert.match(editor, /location\.state\?\.reviewOutline/);
  assert.match(editor, /Select Save version/);
  assert.match(editor, /async function save\(\)/);
});
