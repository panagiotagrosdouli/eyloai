import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlindEyraPacket, validateEyraSourceManifest, verifyIndependentEyraPackets,
  EYRA_SOURCE_MANIFEST_PROTOCOL,
} from '../src/lib/eyra-annotation-packets.mjs';

const manifest = {
  protocol: EYRA_SOURCE_MANIFEST_PROTOCOL,
  dataset_id: 'synthetic-example-not-for-publication',
  cases: Array.from({ length: 10 }, (_, i) => ({
    id: 'example-' + i,
    domain: i % 2 ? 'biology' : 'computer-science',
    claim: 'Claim to be adjudicated ' + i,
    paper: {
      title: 'Illustrative source ' + i,
      abstract: 'A synthetic source abstract with enough words to evaluate the proposed research claim.',
      url: 'https://example.org/synthetic/' + i,
    },
  })),
};

test('two independent review packets contain the same source cases in reproducible blind order', () => {
  const a = buildBlindEyraPacket(manifest, 'annotator-a', 'study-seed-1');
  const b = buildBlindEyraPacket(manifest, 'annotator-b', 'study-seed-1');
  assert.equal(verifyIndependentEyraPackets(a, b), true);
  assert.equal(JSON.stringify(buildBlindEyraPacket(manifest, 'annotator-a', 'study-seed-1')), JSON.stringify(a));
  assert.notDeepEqual(a.cases.map(x => x.id), b.cases.map(x => x.id));
  assert.equal(a.cases.every(c => c.verdict === null && c.rationale === ''), true);
  assert.equal(a.cases.every(c => c.paper.url.startsWith('https://')), true);
  assert.equal(JSON.stringify(a).includes('model_review'), false);
  assert.equal(JSON.stringify(a).includes('expected_supported'), false);
  assert.equal(JSON.stringify(a).includes('adjudicated_verdict'), false);
});

test('a manifest with model answers, human labels or hidden ground truth is refused', () => {
  for (const key of ['model_review', 'expected_supported', 'adjudicated_verdict', 'independent_labels']) {
    const bad = structuredClone(manifest);
    bad.cases[0][key] = 'leaked label';
    assert.throws(() => validateEyraSourceManifest(bad), /Invalid or duplicate/);
  }
  const badTopLevel = { ...manifest, label_origin: 'synthetic' };
  assert.throws(() => validateEyraSourceManifest(badTopLevel), /source-only/);
});

test('invalid, duplicate or missing source rows cannot be silently sampled', () => {
  const duplicate = structuredClone(manifest);
  duplicate.cases[1].id = duplicate.cases[0].id;
  assert.throws(() => validateEyraSourceManifest(duplicate), /duplicate/);
  const missing = structuredClone(manifest);
  missing.cases[0].paper.abstract = '';
  assert.throws(() => buildBlindEyraPacket(missing, 'annotator-a', 'seed'), /Invalid/);
});

test('packet comparison requires different reviewers with the same exact cases', () => {
  const a = buildBlindEyraPacket(manifest, 'reviewer-a', 'seed');
  const b = buildBlindEyraPacket(manifest, 'reviewer-b', 'seed');
  b.cases.pop();
  assert.throws(() => verifyIndependentEyraPackets(a, b), /same evaluation cases/);
  assert.throws(() => verifyIndependentEyraPackets(a, a), /two distinct/);
});
