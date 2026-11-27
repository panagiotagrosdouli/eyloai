import test from 'node:test';
import assert from 'node:assert/strict';
import { collectScientificReviewItems, SCIENTIFIC_ARTIFACTS, updateScientificReview } from '../src/lib/scientific-quality-review.mjs';

test('review discovery connects all five saved research artifact types without manufacturing assessments', () => {
  const project = {
    evidence_matrix: { ai_draft: { rows: [{ claim: 'Claim from matrix', paper_id: 'paper-1', evidence_scope: 'abstract_only' }] } },
    literature_review: { sections: [{ content: 'Review claim', source_ids: ['paper-1'] }] },
    research_proposal: { draft: { sections: [{ content: 'Proposal claim', source_ids: ['paper-2'] }] } },
    research_methodology: { sections: [{ content: 'Method claim', source_ids: ['paper-3'] }] },
    grant_proposal: { edited_sections: [{ content: 'Grant claim', source_ids: ['paper-4'] }] },
  };
  const rows = collectScientificReviewItems(project);
  assert.deepEqual(rows.map(row => row.artifact_label), SCIENTIFIC_ARTIFACTS.map(item => item.label));
  assert.ok(rows.every(row => row.assessment === 'not_yet_reviewed'));
  assert.equal(rows[0].evidence_scope, 'abstract_only');
  assert.ok(rows[1].automated_findings.some(item => item.includes('metadata')));
});

test('review annotations remain project-scoped data and require a valid semantic assessment label', () => {
  const project = { id: 'project-owner-a', scientific_quality_review: {}, research_proposal: { sections: [{ content: 'A saved claim', source_ids: ['paper-a'] }] } };
  const [claim] = collectScientificReviewItems(project);
  const updated = updateScientificReview(project, claim.id, { assessment: 'partially_supported', annotation: 'Inspected the abstract only.', limitation: 'Full text unavailable.' }, { now: '2026-01-01T00:00:00.000Z' });
  assert.equal(updated[claim.id].assessment, 'partially_supported');
  assert.deepEqual(updated[claim.id].source_ids, ['paper-a']);
  assert.equal(updated[claim.id].reviewed_at, '2026-01-01T00:00:00.000Z');
  assert.throws(() => updateScientificReview(project, claim.id, { assessment: 'peer_review_passed' }), /supported scientific review state/);
  assert.throws(() => updateScientificReview(project, 'another-project-claim', { assessment: 'unsupported' }), /no longer present/);
});

test('saving a structural citation link never creates an automated support verdict', () => {
  const project = { grant_proposal: { sections: [{ content: 'Claim text', source_ids: ['valid-id'] }] } };
  const [item] = collectScientificReviewItems(project);
  assert.deepEqual(item.source_ids, ['valid-id']);
  assert.equal(item.assessment, 'not_yet_reviewed');
  assert.ok(item.automated_findings.length);
});
