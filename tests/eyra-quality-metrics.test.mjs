import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEyraResearchQuality } from '../src/lib/eyra-quality-metrics.mjs';

const audited = [
  {
    id: 'paper-review-1',
    citations: [{ id: 'P1', matchesRetrievedRecord: true }, { id: 'P99', matchesRetrievedRecord: false }],
    claims: [{ supportedBySource: true }, { supportedBySource: false }],
    noUsableEvidence: false, disclosedNoEvidence: false,
    unauthorizedWrites: 0, duplicateWrites: 0,
  },
  {
    id: 'empty-retrieval-2',
    citations: [], claims: [],
    noUsableEvidence: true, disclosedNoEvidence: true,
    unauthorizedWrites: 0, duplicateWrites: 0,
  },
];

test('reproducible quality metrics count independent source support separately from citation validity', () => {
  const quality = evaluateEyraResearchQuality(audited);
  assert.equal(quality.reviewedCases, 2);
  assert.deepEqual(quality.citationIdentifierPrecision, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(quality.independentlySupportedClaims, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(quality.noEvidenceDisclosure, { numerator: 1, denominator: 1, rate: 1 });
  assert.equal(quality.unauthorizedWrites, 0);
  assert.equal(quality.duplicateWrites, 0);
});

test('unreviewed scientific claims and invalid safety counts cannot be silently marked correct', () => {
  const sample = audited[0];
  assert.throws(() => evaluateEyraResearchQuality([{ ...sample, claims: [{ citationId: 'P1' }] }]), /independent source-support/);
  assert.throws(() => evaluateEyraResearchQuality([{ ...sample, citations: [{ id: 'P1' }] }]), /unreviewed citation/);
  assert.throws(() => evaluateEyraResearchQuality([{ ...sample, unauthorizedWrites: -1 }]), /invalid unauthorizedWrites/);
  assert.throws(() => evaluateEyraResearchQuality([{ ...sample, duplicateWrites: 0.5 }]), /invalid duplicateWrites/);
});

test('empty corpus and zero-denominator categories report null instead of invented success', () => {
  const empty = evaluateEyraResearchQuality([]);
  assert.equal(empty.reviewedCases, 0);
  assert.equal(empty.independentlySupportedClaims.rate, null);
  assert.equal(empty.citationIdentifierPrecision.rate, null);
  assert.equal(empty.noEvidenceDisclosure.rate, null);
  assert.throws(() => evaluateEyraResearchQuality([audited[0], audited[0]]), /unique nonempty id/);
});
