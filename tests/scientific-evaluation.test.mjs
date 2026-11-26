import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCIENTIFIC_DIMENSIONS, CLAIM_SUPPORT_LABELS, evaluateScientificPacket,
} from '../src/lib/scientific-evaluation.mjs';

const realReference = JSON.parse(readFileSync(new URL('./fixtures/scientific-evaluation/public-reference-packet.json', import.meta.url), 'utf8'));
const make = () => structuredClone(realReference);

test('real publication reference packet remains unjudged and never grants release', () => {
  const result = evaluateScientificPacket(make());
  assert.equal(result.valid, true);
  assert.equal(result.gate, 'BLOCKED_UNREVIEWED');
  assert.equal(result.release_authorized, false);
  assert.equal(result.totals.reference_publications, 2);
  assert.equal(result.totals.unresolved_dimensions.length, 8);
  assert.equal(result.totals.claims, 0);
});

test('unrecognized and fabricated citation IDs fail closed', () => {
  const packet = make();
  packet.claims.push({ id: 'claim-1', kind: 'factual', text: 'Synthetic test claim', source_ids: ['nonexistent-doi-record'] });
  const result = evaluateScientificPacket(packet);
  assert.equal(result.gate, 'BLOCKED_INVALID');
  assert.ok(result.errors.includes('unrecognized_source_identifier'));
  assert.equal(result.release_authorized, false);
});

test('reusing one reviewer twice does not fake independent agreement', () => {
  const packet = make();
  packet.claims.push({ id: 'claim-1', kind: 'factual', text: 'Synthetic test claim', source_ids: ['ioannidis-2005'] });
  const rating = { claim_id: 'claim-1', reviewer_id: 'expert-1', source_id: 'ioannidis-2005', verdict: 'partially_supported', evidence_scope: 'abstract_only', evidence_locator: 'abstract, paragraph 1', rationale: 'Synthetic reviewer text for structural validation only.' };
  packet.claim_reviews.push(rating, { ...rating });
  const result = evaluateScientificPacket(packet);
  assert.ok(result.errors.includes('duplicate_claim_reviewer'));
  assert.equal(result.gate, 'BLOCKED_INVALID');
});

test('claim support requires inspected evidence, traceable source and a nonempty rationale', () => {
  const packet = make();
  packet.claims.push({ id: 'claim-1', kind: 'factual', text: 'Synthetic test claim', source_ids: ['ioannidis-2005'] });
  packet.claim_reviews.push({ claim_id: 'claim-1', reviewer_id: 'expert-1', source_id: 'ioannidis-2005', verdict: 'supported_by_inspected_evidence', evidence_scope: 'metadata_only', evidence_locator: '', rationale: '' });
  assert.ok(evaluateScientificPacket(packet).errors.includes('unsubstantiated_human_judgment'));
  packet.claim_reviews[0].source_id = 'ioannidis-2022-correction';
  assert.ok(evaluateScientificPacket(packet).errors.includes('review_source_not_in_claim'));
});

test('abstract support remains explicitly abstract-only, never full-text verified', () => {
  const packet = make();
  packet.claims.push({ id: 'claim-1', kind: 'factual', text: 'Synthetic test claim', source_ids: ['ioannidis-2005'] });
  for (const i of [1, 2]) packet.claim_reviews.push({ claim_id: 'claim-1', reviewer_id: 'expert-' + i, source_id: 'ioannidis-2005', verdict: 'supported_by_inspected_evidence', evidence_scope: 'abstract_only', evidence_locator: 'abstract, opening lines', rationale: 'This is synthetic structural-test input only, not a human rating.' });
  const report = evaluateScientificPacket(packet);
  assert.equal(report.totals.abstract_only_supported_claim_reviews, 2);
  assert.equal(report.totals.full_text_inspections_recorded, 0);
  assert.equal(report.totals.unresolved_factual_claims, 0);
  assert.ok(report.warnings.includes('abstract_only_support_is_not_full_text_verification'));
  assert.equal(report.gate, 'BLOCKED_UNREVIEWED');
});

test('all eight dimensions and all six semantic classes are enumerated', () => {
  assert.equal(SCIENTIFIC_DIMENSIONS.length, 8);
  assert.equal(new Set(CLAIM_SUPPORT_LABELS).size, 6);
  assert.ok(CLAIM_SUPPORT_LABELS.includes('contradicted'));
  assert.ok(CLAIM_SUPPORT_LABELS.includes('insufficient_accessible_source_material'));
  assert.ok(CLAIM_SUPPORT_LABELS.includes('not_yet_reviewed'));
});

test('even full structural review data is never scientific approval', () => {
  const packet = make();
  packet.claims.push({ id: 'claim-1', kind: 'factual', text: 'Synthetic test claim', source_ids: ['ioannidis-2005'] });
  for (const id of ['expert-1', 'expert-2']) {
    packet.claim_reviews.push({ claim_id: 'claim-1', reviewer_id: id, source_id: 'ioannidis-2005', verdict: 'insufficient_accessible_source_material', evidence_scope: 'abstract_only', evidence_locator: 'abstract only', rationale: 'Synthetic input confirms only structural validation, not science.' });
    for (const dimension of SCIENTIFIC_DIMENSIONS) packet.dimension_reviews.push({ dimension, reviewer_id: id, verdict: 'insufficient_material', rationale: 'Synthetic structural input needs actual independent expert review.' });
  }
  const report = evaluateScientificPacket(packet);
  assert.equal(report.valid, true);
  assert.equal(report.gate, 'REVIEW_DATA_COMPLETE_PENDING_INDEPENDENT_ACCEPTANCE');
  assert.equal(report.release_authorized, false);
  assert.equal(report.totals.unresolved_dimensions.length, 0);
});

test('invalid metadata and correction DOI cannot pass source validation', () => {
  const packet = make();
  packet.records[0].doi = '10.not-a-doi';
  packet.records[1].correction_doi = 'invalid';
  const report = evaluateScientificPacket(packet);
  assert.ok(report.errors.includes('invalid_publication_record'));
  assert.ok(report.errors.includes('invalid_correction_doi'));
});
