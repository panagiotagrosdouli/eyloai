import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cli = resolve('scripts/evaluate-eyra-quality.mjs');

test('CLI produces a deliberately unjudged worksheet and rejects it until human review', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eyra-human-audit-'));
  try {
    const labelsPath = join(dir, 'labels.json');
    const reportPath = join(dir, 'report.json');
    const template = execFileSync(process.execPath, [cli, 'template', labelsPath], { encoding: 'utf8' });
    assert.match(template, /No scientific quality was measured/);
    const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
    assert.equal(labels.cases[0].claims[0].supportedBySource, null);
    const denied = spawnSync(process.execPath, [cli, 'evaluate', labelsPath, reportPath], { encoding: 'utf8' });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /unreviewed citation|requires reviewerId|independent source-support/);
    assert.throws(() => readFileSync(reportPath, 'utf8'), /ENOENT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exports only reviewed aggregate metrics and refuses overwriting audit artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eyra-human-audit-'));
  try {
    const labelsPath = join(dir, 'labels.json');
    const reportPath = join(dir, 'report.json');
    const data = { cases: [{
      id: 'case-a', reviewerId: 'reviewer-private', domain: 'biomedical',
      citations: [{ id: 'P1', matchesRetrievedRecord: true }],
      claims: [{ supportedBySource: false }],
      noUsableEvidence: false, disclosedNoEvidence: false,
      unauthorizedWrites: 0, duplicateWrites: 0,
      privateSourceUrl: 'https://example.org/unpublished',
      prompt: 'Private research question',
    }] };
    writeFileSync(labelsPath, JSON.stringify(data));
    const response = execFileSync(process.execPath, [cli, 'evaluate', labelsPath, reportPath], { encoding: 'utf8' });
    assert.match(response, /aggregate-only report/);
    const output = readFileSync(reportPath, 'utf8');
    assert.equal(JSON.parse(output).overall.independentlySupportedClaims.rate, 0);
    for (const secret of ['reviewer-private', 'example.org', 'Private research question', 'case-a']) {
      assert.ok(!output.includes(secret), `Raw case information must never appear: ${secret}`);
    }
    const denied = spawnSync(process.execPath, [cli, 'evaluate', labelsPath, reportPath], { encoding: 'utf8' });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /EEXIST/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
