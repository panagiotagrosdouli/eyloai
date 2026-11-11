import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectEyraReport } from '../src/lib/project-eyra-provenance.mjs';
import { readFileSync } from 'node:fs';

const live = {
  papers: [{ title: 'Verified publication' }],
  researchers: [{ name: 'Verified researcher' }],
  opportunities: [{ title: 'Official call' }],
  hasLiveEvidence: true,
};

test('project research report accepts IDs grounded in the exact retrieved evidence set', () => {
  const text = 'Verified paper [P1], researcher [R1] and grant [F1]';
  assert.equal(validateProjectEyraReport(text, live), text);
});

test('invented or out-of-range source IDs cannot enter saved research analysis', () => {
  for (const text of ['Invented paper [P2]', 'Invented researcher [R3]', 'Unretrieved institution [I1]', 'Imaginary call [F9]']) {
    assert.throws(() => validateProjectEyraReport(text, live), /unverified source ID/);
  }
});

test('a sourced claim cannot be saved when the model omits all source IDs', () => {
  assert.throws(() => validateProjectEyraReport('The papers prove a research gap.', live), /omitted source IDs/);
  assert.throws(() => validateProjectEyraReport({ text:'[P1]' }, live), /valid evidence report/);
});

test('workspace-only draft may lack live source IDs but cannot invent one', () => {
  const noLive = { papers: [], researchers: [], opportunities: [], hasLiveEvidence: false };
  assert.equal(validateProjectEyraReport('Workspace-only draft; not externally verified.', noLive),
    'Workspace-only draft; not externally verified.');
  assert.throws(() => validateProjectEyraReport('Fabricated external citation [P1]', noLive), /unverified/);
});

test('Project Detail validates citations before the persisted project write', () => {
  const source = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');
  const validation = source.indexOf('validateProjectEyraReport(result, { papers, researchers, opportunities, hasLiveEvidence })');
  const save = source.indexOf('Project.update(id, { eyra_analysis: result })');
  assert.ok(validation > 0 && save > validation);
});
