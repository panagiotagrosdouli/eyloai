import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPRODUCIBILITY_ITEMS, emptyReproducibilityReview, validateReproducibilityReview,
  reproducibilityDocumentationSummary, reproducibilityReviewSnapshot,
} from '../src/lib/reproducibility-review.mjs';

const entries = Object.fromEntries(REPRODUCIBILITY_ITEMS.map(([id]) => [
  id, { status: 'not_assessed', evidence: '' },
]));

test('human-authored review requires a materials reference', () => {
  const r = validateReproducibilityReview(emptyReproducibilityReview());
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /materials assessed/);
});

test('documented and not-applicable methods require human-provided source location or explanation', () => {
  const r = validateReproducibilityReview({
    manuscript_reference: 'Draft v2',
    entries: { research_question: { status: 'documented', evidence: '' }, ethics: { status: 'not_applicable', evidence: ' ' } },
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /research_question/);
  assert.match(r.errors.join(' '), /ethics/);
});

test('no AI quality score or reproducibility verdict follows from documented sections', () => {
  const value = { manuscript_reference: 'OSF registered protocol', entries: {
    research_question: { status: 'documented', evidence: 'Methods §1' },
    analysis: { status: 'missing', evidence: 'No code described' },
    ethics: { status: 'not_applicable', evidence: 'Purely synthetic data' },
  } };
  const r = validateReproducibilityReview(value);
  assert.equal(r.ok, true);
  const summary = reproducibilityDocumentationSummary(r.value);
  assert.deepEqual(summary.counts, { not_assessed: 5, documented: 1, missing: 1, not_applicable: 1 });
  assert.match(summary.disclaimer, /not proof/);
  const snapshot = reproducibilityReviewSnapshot({ id: 'owner-project', title: 'My research' }, r.value, '2026-11-12T00:00:00Z');
  assert.equal(snapshot.project_id, 'owner-project');
  assert.equal(snapshot.review.entries.ethics.evidence, 'Purely synthetic data');
  assert.match(snapshot.limitation, /not been independently validated/);
});

test('unknown checklist fields and invalid status values are rejected instead of persisted', () => {
  const value = validateReproducibilityReview({
    manuscript_reference: 'My draft',
    entries: { invented: { status: 'documented', evidence: 'x' }, procedure: { status: 'proven', evidence: 'x' } },
  });
  assert.equal(value.ok, false);
  assert.match(value.errors.join(' '), /Unknown/);
  assert.match(value.errors.join(' '), /Invalid status/);
});
