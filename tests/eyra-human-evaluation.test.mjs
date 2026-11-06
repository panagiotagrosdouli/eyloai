import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAdjudicatedEvidence, wilson95, HUMAN_REVIEW_PROTOCOL } from '../src/lib/eyra-human-evaluation.mjs';

function caseItem(id, supported, {
  domain = 'medicine', verdict = supported ? 'supported' : 'unsupported',
  source = 'An observational study reported no significant association between exposure and response after adjustment.',
  claim = supported ? 'No significant association was reported.' : 'The study proved a large causal benefit.',
  quote = verdict === 'supported' ? source : '',
} = {}) {
  return {
    id, domain, claim,
    paper: { title: 'Synthetic illustration', abstract: source, url: 'https://example.org/illustrative-only' },
    independent_labels: [
      { reviewer_id: 'annotator-a', verdict: supported ? 'supported' : 'unsupported' },
      { reviewer_id: 'annotator-b', verdict: supported ? 'supported' : 'unsupported' },
    ],
    adjudicated_verdict: supported ? 'supported' : 'unsupported',
    adjudication_rationale: 'The abstract supports the final human label on this claim.',
    model_review: { claim_id: 'F0', verdict, source_id: 'P1', quote, explanation: 'Synthetic only' },
  };
}

function fixture(items) {
  return { protocol: HUMAN_REVIEW_PROTOCOL, dataset_id: 'synthetic-unit-test-only',
    label_origin: 'synthetic_only', cases: items };
}

test('Wilson upper bound makes small zero-error samples uncertain', () => {
  assert.equal(wilson95(0, 0).upper, null);
  assert.ok(wilson95(0, 8).upper > 0.25);
  assert.ok(wilson95(0, 75).upper < 0.05);
  assert.throws(() => wilson95(2, 1), /Invalid/);
});

test('synthetic examples are rejected by the default real-human evaluation path', () => {
  assert.throws(
    () => evaluateAdjudicatedEvidence(fixture([caseItem('s1', true)])),
    /human adjudication/,
  );
});

test('human label annotations must be distinct and fully adjudicated', () => {
  const sameReviewer = caseItem('s1', false);
  sameReviewer.independent_labels[1].reviewer_id = 'annotator-a';
  assert.throws(() => evaluateAdjudicatedEvidence(fixture([sameReviewer]), { requireHuman: false }), /independent reviewer/);
  const missing = caseItem('s2', false);
  delete missing.model_review;
  assert.throws(() => evaluateAdjudicatedEvidence(fixture([missing]), { requireHuman: false }), /Missing reviewer model output/);
});

test('metrics distinguish mistaken AI reviewer support from actual published false accepts', () => {
  const source = 'An observational study reported no significant association between exposure and response after adjustment.';
  const fabricated = caseItem('s1', false, { verdict: 'supported', quote: 'invented quotation that was never in the abstract' });
  const genuine = caseItem('s2', false, { verdict: 'supported', quote: source });
  const positive = caseItem('s3', true, { verdict: 'supported', quote: source });
  const result = evaluateAdjudicatedEvidence(fixture([fabricated, genuine, positive]), { requireHuman: false });
  assert.equal(result.overall.reviewer.fp, 2);
  assert.equal(result.overall.published.fp, 1);
  assert.equal(result.overall.published.tp, 1);
  assert.equal(result.overall.published.tn, 1);
  assert.equal(result.screening_passed, false);
});

test('missing or malformed model output cannot be mislabeled as a correct rejection', () => {
  const item = caseItem('s1', false);
  item.model_review.claim_id = 'F999';
  assert.throws(() => evaluateAdjudicatedEvidence(fixture([item]), { requireHuman: false }), /Malformed reviewer output/);
});

test('tiny or single-domain datasets cannot pass screening even if all outcomes are correct', () => {
  const item = caseItem('s1', true, { verdict: 'supported' });
  const data = fixture([item, caseItem('s2', false)]);
  data.label_origin = 'independent_human_adjudication';
  const scored = evaluateAdjudicatedEvidence(data);
  assert.equal(scored.screening_passed, false);
  assert.equal(scored.domains.medicine.published.positive_cases, 1);
  assert.equal(scored.domains.medicine.published.negative_cases, 1);
});
