import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEyraQualityReport, wilson95 } from '../src/lib/eyra-quality-report.mjs';

const reviewed = [
  {
    id: 'domain-1', domain: 'biomedical', reviewerId: 'rA',
    citations: [{ id: 'P1', matchesRetrievedRecord: true }, { id: 'P2', matchesRetrievedRecord: false }],
    claims: [{ supportedBySource: false }, { supportedBySource: true }],
    noUsableEvidence: false, disclosedNoEvidence: false,
    unauthorizedWrites: 0, duplicateWrites: 0,
    privateSourceUrl: 'https://private.example/research',
  },
  {
    id: 'domain-2', domain: 'engineering', reviewerId: 'rB',
    citations: [], claims: [],
    noUsableEvidence: true, disclosedNoEvidence: true,
    unauthorizedWrites: 0, duplicateWrites: 0,
    privatePrompt: 'Sensitive unpublished research topic',
  },
];

test('exact counts and domain denominators remain distinct from claimed scientific truth', () => {
  const result = createEyraQualityReport({ cases: reviewed });
  assert.equal(result.reviewedCases, 2);
  assert.equal(result.distinctReviewerIds, 2);
  assert.equal(result.samplingAdequacy, 'INSUFFICIENT_FOR_PLANNED_50_CASE_AUDIT');
  assert.deepEqual(result.overall.citationIdentifierPrecision.numerator, 1);
  assert.deepEqual(result.overall.citationIdentifierPrecision.denominator, 2);
  assert.equal(result.overall.citationIdentifierPrecision.rate, 0.5);
  assert.equal(result.overall.independentlySupportedClaims.rate, 0.5);
  assert.equal(result.overall.noEvidenceDisclosure.rate, 1);
  assert.equal(result.byDomain.biomedical.noEvidenceDisclosure.rate, null);
  assert.equal(result.byDomain.engineering.citationIdentifierPrecision.rate, null);
});

test('aggregates do not export private research prompts, source URLs or raw labels', () => {
  const result = createEyraQualityReport({ cases: reviewed });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('Sensitive unpublished'));
  assert.ok(!serialized.includes('private.example'));
  assert.ok(!serialized.includes('domain-1'));
  assert.ok(!serialized.includes('rA'));
  assert.ok(serialized.includes('biomedical'));
});

test('missing reviews are rejected rather than interpreted as negative labels', () => {
  assert.throws(() => createEyraQualityReport({ cases: [{ ...reviewed[0], reviewerId: '' }] }), /requires reviewerId/);
  assert.throws(() => createEyraQualityReport({ cases: [{ ...reviewed[0], claims: [{ supportedBySource: null }] }] }), /independent source-support/);
  assert.throws(() => createEyraQualityReport({ cases: [{ ...reviewed[0], unauthorizedWrites: null }] }), /invalid unauthorizedWrites/);
  assert.throws(() => createEyraQualityReport({ cases: [reviewed[0], reviewed[0]] }), /unique nonempty id/);
  assert.throws(() => createEyraQualityReport(null), /Expected/);
});

test('unmeasured categories stay null and Wilson confidence intervals stay bounded', () => {
  const empty = createEyraQualityReport({ cases: [] });
  assert.equal(empty.status, 'NOT_MEASURED');
  assert.equal(empty.overall.independentlySupportedClaims.wilson95, null);
  assert.equal(wilson95(0, 0), null);
  const sample = wilson95(1, 2);
  assert.ok(sample.lower >= 0 && sample.upper <= 1);
  assert.ok(sample.lower < 0.5 && sample.upper > 0.5);
  assert.throws(() => wilson95(3, 2), /valid success/);
});

test('mobile tools outside-click handler explicitly allows the mobile menu', () => {
  const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
  assert.match(layout, /ref=\{mobilePanelRef\}/);
  assert.match(layout, /!mobilePanelRef\.current\?\.contains\(event\.target\)/);
  assert.match(layout, /id="mobile-tool-directory"/);
});
