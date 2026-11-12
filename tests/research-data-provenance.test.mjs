import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256ResearchFile, buildResearchDataProvenance } from '../src/lib/research-data-provenance.mjs';
import { readFileSync } from 'node:fs';

test('SHA-256 matches a known vector for exact original bytes', async () => {
  const bytes = new TextEncoder().encode('abc');
  assert.equal(await sha256ResearchFile(bytes),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const changed = new TextEncoder().encode('abc\n');
  assert.notEqual(await sha256ResearchFile(changed), await sha256ResearchFile(bytes));
});

test('SHA-256 does not silently claim success in an unsupported browser context', async () => {
  await assert.rejects(() => sha256ResearchFile(new Uint8Array([1, 2, 3]), null),
    error => error.code === 'RESEARCH_DIGEST_UNAVAILABLE');
  await assert.rejects(() => sha256ResearchFile('not binary'),
    /File bytes must be/);
});

test('reproducibility manifest is bounded and does not contain raw dataset rows', () => {
  const manifest = buildResearchDataProvenance({
    fileName: 'study.csv', byteLength: 8, rowCount: 1, columnCount: 2,
    sha256: 'a'.repeat(64),
  });
  assert.equal(manifest.algorithm, 'SHA-256');
  assert.equal(manifest.sha256, 'a'.repeat(64));
  assert.equal(manifest.file_bytes, 8);
  assert.equal(manifest.data_rows, 1);
  assert.equal('rows' in manifest, false);
  assert.match(manifest.disclaimer, /not a signature/);
  assert.throws(() => buildResearchDataProvenance({
    fileName: 'data.csv', byteLength: 2, rowCount: 1, columnCount: 2, sha256: 'invalid',
  }), /verified SHA-256 digest/);
});

test('Data Lab computes provenance locally and exports no raw CSV values', () => {
  const ui = readFileSync(new URL('../src/pages/ResearchDataLab.jsx', import.meta.url), 'utf8');
  assert.match(ui, /sha256ResearchFile\(rawBytes\)/);
  assert.match(ui, /file\.arrayBuffer\(\)/);
  assert.match(ui, /provenance: fileDigest && dataset/);
  assert.match(ui, /The optional fingerprint is included in the aggregate JSON report/);
  assert.doesNotMatch(ui, /fetch\([^)]*rawBytes/);
});
