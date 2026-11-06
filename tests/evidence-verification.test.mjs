import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewableClaims, selectExcerptSupportedClaims, validateEvidenceReviewBatch } from '../src/lib/evidence-verification.mjs';

const papers = [
  { summary: 'The model reduced trajectory error on the held-out pedestrian test set.', url: 'https://doi.org/10.1234/example' },
  { summary: 'This study investigated multimodal intersections using fixed roadside cameras.', url: 'https://example.org/paper2' },
];
const analysis = {
  key_findings: [
    { finding: 'The model reduced error', evidence: 'Paper [P1]', confidence: 'HIGH' },
    { finding: 'An unsupported claim', evidence: 'Paper [P2]', confidence: 'HIGH' },
    { finding: 'Only a researcher cite', evidence: 'Scholar [Researcher 1]', confidence: 'HIGH' },
  ],
  trends: [{ description: 'Intersections with multiple agents were investigated', evidence: '[P2]', title: 'Traffic sensing' }],
};

test('selects only paper-cited claims for semantic review', () => {
  assert.deepEqual(reviewableClaims(analysis).map(item => item.id), ['F0', 'F1', 'T0']);
});

test('accepts a model-assessed claim only with an exact excerpt from its cited abstract', () => {
  const output = selectExcerptSupportedClaims(analysis, [{
    claim_id: 'F0', verdict: 'supported', source_id: 'P1',
    quote: 'reduced trajectory error on the held-out pedestrian test set',
  }], papers);
  assert.equal(output.key_findings.length, 1);
  assert.equal(output.key_findings[0].source_id, '[P1]');
  assert.equal(output.trends.length, 0);
  assert.equal(output.evidence_review.claims_retained, 1);
});

test('does not trust invented quotations, uncited sources, or non-supported verdicts', () => {
  const output = selectExcerptSupportedClaims(analysis, [
    { claim_id: 'F0', verdict: 'supported', source_id: 'P1', quote: 'random fabricated quote that never appeared' },
    { claim_id: 'F0', verdict: 'supported', source_id: 'P2', quote: papers[1].summary },
    { claim_id: 'F1', verdict: 'unsupported', source_id: 'P2', quote: papers[1].summary },
    { claim_id: 'F1', verdict: 'supported', source_id: 'P99', quote: papers[1].summary },
    { claim_id: 'F2', verdict: 'supported', source_id: 'P1', quote: papers[0].summary },
  ], papers);
  assert.equal(output.key_findings.length, 0);
});

test('rejects unsupported source text and fails closed when review is missing', () => {
  const output = selectExcerptSupportedClaims(analysis, null, papers);
  assert.deepEqual(output.key_findings, []);
  assert.deepEqual(output.trends, []);
  assert.equal(output.evidence_review.claims_checked, 3);
});

test('allows trend with a source-matching excerpt but never claims scientific proof', () => {
  const output = selectExcerptSupportedClaims(analysis, [{
    claim_id: 'T0', verdict: 'supported', source_id: 'P2',
    quote: 'investigated multimodal intersections using fixed roadside cameras',
  }], papers);
  assert.equal(output.trends.length, 1);
  assert.match(output.trends[0].evidence_review_label, /not independent verification/);
});

test('does not accept excerpts from paper titles when no abstract supports them', () => {
  const output = selectExcerptSupportedClaims(analysis, [{
    claim_id: 'F0', verdict: 'supported', source_id: 'P1', quote: papers[0].summary,
  }], [{ title: papers[0].summary, summary: '', url: 'https://example.org' }]);
  assert.equal(output.key_findings.length, 0);
});

test('rejects a quote that is trivially short', () => {
  const output = selectExcerptSupportedClaims(analysis, [{
    claim_id: 'F0', verdict: 'supported', source_id: 'P1', quote: 'reduced trajectory',
  }], papers);
  assert.equal(output.key_findings.length, 0);
});

test('rejects incomplete model output rather than publishing only its favorable verdicts', () => {
  const candidateIds = reviewableClaims(analysis);
  const batch = [{ claim_id: 'F0', verdict: 'supported', source_id: 'P1', quote: papers[0].summary }];
  assert.equal(validateEvidenceReviewBatch(candidateIds, batch).ok, false);
  const output = selectExcerptSupportedClaims(analysis, batch, papers);
  assert.equal(output.evidence_review.status, 'invalid_batch');
  assert.deepEqual(output.key_findings, []);
});

test('rejects conflicting, duplicate or invented reviewer claim IDs', () => {
  const expected = reviewableClaims(analysis);
  const valid = expected.map(c => ({ claim_id: c.id, verdict: 'insufficient', source_id: '', quote: '' }));
  assert.equal(validateEvidenceReviewBatch(expected, valid).ok, true);
  const duplicate = [valid[0], valid[0], valid[2]];
  assert.equal(validateEvidenceReviewBatch(expected, duplicate).ok, false);
  const unknown = [...valid.slice(0, 2), { ...valid[2], claim_id: 'F999' }];
  assert.equal(validateEvidenceReviewBatch(expected, unknown).ok, false);
  assert.deepEqual(selectExcerptSupportedClaims(analysis, duplicate, papers).key_findings, []);
});

test('rejects non-supported verdicts with a genuine quote attached', () => {
  const expected = reviewableClaims(analysis);
  const invalid = expected.map((c, i) => ({
    claim_id: c.id, verdict: i === 0 ? 'unsupported' : 'insufficient',
    source_id: 'P1', quote: i === 0 ? papers[0].summary : '',
  }));
  assert.equal(validateEvidenceReviewBatch(expected, invalid).ok, false);
  assert.equal(selectExcerptSupportedClaims(analysis, invalid, papers).evidence_review.status, 'invalid_batch');
});

test('still allows a complete, consistent reviewer batch with a genuine quote', () => {
  const expected = reviewableClaims(analysis);
  const batch = expected.map((c, i) => ({
    claim_id: c.id, verdict: i === 0 ? 'supported' : 'insufficient',
    source_id: i === 0 ? 'P1' : '', quote: i === 0 ? papers[0].summary : '',
  }));
  assert.equal(validateEvidenceReviewBatch(expected, batch).ok, true);
  assert.equal(selectExcerptSupportedClaims(analysis, batch, papers).key_findings.length, 1);
});
