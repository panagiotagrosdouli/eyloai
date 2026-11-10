import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewableClaims, selectExcerptSupportedClaims } from '../src/lib/evidence-verification.mjs';

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

test('accepts a literal supported excerpt beyond the first 240 abstract characters', () => {
  const tail = 'The intervention improved retention across the full study cohort.';
  const longAbstract = 'Background information about the research context. '.repeat(7) + tail;
  const output = selectExcerptSupportedClaims(analysis, [{
    claim_id: 'F0', verdict: 'supported', source_id: 'P1', quote: tail,
  }], [{ summary: longAbstract, url: 'https://example.org/full-abstract' }]);
  assert.equal(output.key_findings.length, 1);
  assert.equal(output.key_findings[0].source_excerpt, tail);
});
