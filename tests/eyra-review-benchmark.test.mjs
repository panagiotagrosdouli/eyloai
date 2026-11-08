import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_REVIEW_CASES as CASES } from './fixtures/eyra-review-cases.mjs';
import { buildEvidenceReviewPrompt } from '../src/lib/evidence-review-prompt.mjs';
import { selectExcerptSupportedClaims } from '../src/lib/evidence-verification.mjs';

test('evaluation set has independent positive and negative labels across domains', () => {
  assert.ok(CASES.length >= 10);
  assert.ok(CASES.some(c => c.expected_supported));
  assert.ok(CASES.some(c => !c.expected_supported));
  assert.ok(new Set(CASES.map(c => c.domain)).size >= 4);
  assert.equal(new Set(CASES.map(c => c.id)).size, CASES.length);
});

test('production reviewer prompt never receives fixture labels', () => {
  for (const item of CASES) {
    const prompt = buildEvidenceReviewPrompt([{ id: 'F0', claim: item.claim, evidence: '[P1]' }], [{ title: item.title, summary: item.abstract }]);
    assert.ok(prompt.includes(item.claim));
    assert.ok(prompt.includes(item.abstract.slice(0, 100)));
    assert.ok(!prompt.includes('expected_supported'));
  }
});

test('verbatim quotations alone can falsely accept semantic contradictions', () => {
  const sample = CASES.find(c => c.id === 'negation-reversed');
  const outcome = selectExcerptSupportedClaims({key_findings: [{finding: sample.claim, evidence: '[P1]'}]}, [
    {claim_id: 'F0', verdict: 'supported', source_id: 'P1', quote: sample.abstract},
  ], [{title: sample.title, summary: sample.abstract, url: 'https://example.org/synthetic'}]);
  // This is intentionally recorded as a limitation: the model verdict is the
  // semantic check; the deterministic layer only checks quote authenticity.
  assert.equal(outcome.key_findings.length, 1);
  assert.match(outcome.key_findings[0].evidence_review_label, /not independent verification/);
});
