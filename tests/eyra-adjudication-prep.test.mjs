import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBlindEyraPacket, EYRA_SOURCE_MANIFEST_PROTOCOL } from '../src/lib/eyra-annotation-packets.mjs';
import { prepareEyraAdjudicationDraft, EYRA_ADJUDICATION_DRAFT_PROTOCOL } from '../src/lib/eyra-adjudication-prep.mjs';

const manifest = {
  protocol: EYRA_SOURCE_MANIFEST_PROTOCOL,
  dataset_id: 'synthetic-audit-unit-test',
  cases: [
    { id: 'synthetic-1', domain: 'medicine', claim: 'An intervention improved survival.',
      paper: { title: 'Synthetic trial', abstract: 'In a synthetic trial, the intervention did not improve survival compared with standard treatment.',
        url: 'https://example.org/synthetic-1' } },
    { id: 'synthetic-2', domain: 'AI', claim: 'Trajectory forecasting was tested with camera input.',
      paper: { title: 'Synthetic simulation', abstract: 'A simulated traffic scenario used fixed road cameras to evaluate vehicle trajectory forecasting.',
        url: 'https://example.org/synthetic-2' } },
  ],
};
const raw = JSON.stringify(manifest);
const seed = 'study-unit-test-seed';
const audit = {
  protocol: 'eyra-annotation-audit-v1',
  dataset_id: manifest.dataset_id, case_count: manifest.cases.length,
  source_sha256: createHash('sha256').update(raw).digest('hex'),
  seed, reviewer_ids: ['reviewer-a', 'reviewer-b'],
};
function completed() {
  const a = buildBlindEyraPacket(manifest, 'reviewer-a', seed);
  const b = buildBlindEyraPacket(manifest, 'reviewer-b', seed);
  for (const packet of [a, b]) {
    packet.cases.forEach(c => {
      c.verdict = c.id === 'synthetic-1' ? 'unsupported' : 'supported';
      c.rationale = 'The supplied excerpt addresses this specific claim.';
    });
  }
  const discrepant = b.cases.find(c => c.id === 'synthetic-1');
  discrepant.verdict = 'partial';
  return [a, b];
}

test('only a draft is generated; every adjudication remains unassigned', () => {
  const [a, b] = completed();
  const result = prepareEyraAdjudicationDraft(raw, audit, a, b);
  assert.equal(result.protocol, EYRA_ADJUDICATION_DRAFT_PROTOCOL);
  assert.equal(result.status, 'needs_independent_adjudication');
  assert.equal(result.case_count, 2);
  assert.equal(result.disagreement_count, 1);
  assert.deepEqual(result.cases.map(c => c.id), manifest.cases.map(c => c.id));
  assert.equal(result.cases.every(c => c.adjudicated_verdict === null && c.adjudication_rationale === ''), true);
  assert.equal(result.cases.every(c => c.independent_labels.length === 2), true);
  assert.equal(JSON.stringify(result).includes('model_review'), false);
  assert.equal(JSON.stringify(result).includes('independent_human_adjudication'), false);
});

test('rejects tampered source text, mismatched hash and altered study case IDs', () => {
  const [a, b] = completed();
  const edited = structuredClone(b);
  edited.cases[0].paper.abstract += ' MALICIOUSLY CHANGED';
  assert.throws(() => prepareEyraAdjudicationDraft(raw, audit, a, edited), /source claim.*changed/);
  const changedHash = { ...audit, source_sha256: '0'.repeat(64) };
  assert.throws(() => prepareEyraAdjudicationDraft(raw, changedHash, a, b), /Source audit hash/);
  const changedDataset = structuredClone(b);
  changedDataset.cases[0].id = 'unknown-id';
  assert.throws(() => prepareEyraAdjudicationDraft(raw, audit, a, changedDataset), /source claim.*changed/);
});

test('rejects incompletely annotated or contaminated packets and mismatched reviewers', () => {
  const [a, b] = completed();
  b.cases[0].verdict = null;
  assert.throws(() => prepareEyraAdjudicationDraft(raw, audit, a, b), /missing verdict/);
  b.cases[0].verdict = 'supported';
  b.cases[0].model_review = { verdict: 'supported' };
  assert.throws(() => prepareEyraAdjudicationDraft(raw, audit, a, b), /source claim.*changed/);
  delete b.cases[0].model_review;
  assert.throws(() => prepareEyraAdjudicationDraft(raw, audit, b, a), /Reviewer packet metadata/);
});

test('cannot inject ground truth or reviewer interpretations into the original manifest', () => {
  const [a, b] = completed();
  const bad = structuredClone(manifest);
  bad.cases[0].adjudicated_verdict = 'supported';
  assert.throws(() => prepareEyraAdjudicationDraft(JSON.stringify(bad), audit, a, b), /Invalid or duplicate source case/);
});

test('offline adjudication collection CLI refuses replacing an existing draft', () => {
  const root = mkdtempSync(join(tmpdir(), 'eyra-adjudication-'));
  try {
    const paths = ['source.json', 'audit.json', 'reviewer-a.json', 'reviewer-b.json'].map(f => join(root, f));
    const [a,b] = completed();
    [raw, JSON.stringify(audit), JSON.stringify(a), JSON.stringify(b)].forEach((s, i) => writeFileSync(paths[i], s));
    const output = join(root, 'draft.json');
    const cli = fileURLToPath(new URL('../scripts/reconcile-eyra-annotations.mjs', import.meta.url));
    const args = [cli, '--source', paths[0], '--audit', paths[1], '--reviewer-a', paths[2], '--reviewer-b', paths[3], '--out', output];
    const first = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
    assert.equal(first.status, 0, first.stderr);
    const generated = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(generated.disagreement_count, 1);
    assert.equal(generated.cases[0].adjudicated_verdict, null);
    const original = readFileSync(output, 'utf8');
    const again = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(again.status, 0);
    assert.equal(readFileSync(output, 'utf8'), original);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
