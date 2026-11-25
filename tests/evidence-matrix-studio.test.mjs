import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEvidenceMatrixPrompt,
  EVIDENCE_MATRIX_SCHEMA,
  exportEvidenceMatrixStudioCsv,
  validateEvidenceMatrixDraft,
} from '../src/lib/evidence-matrix-studio.mjs';

const selected = [
  { id: 'paper-1', title: 'Randomized trial', authors: 'A. Researcher', year: 2024, doi: '10.1234/example', summary: 'The randomized trial enrolled 90 adults and compared treatment with placebo.', url: 'https://doi.org/10.1234/example', project_id: 'project-1' },
  { id: 'paper-2', title: 'Cohort study', summary: '', url: 'https://openalex.org/W123', project_id: 'project-1' },
];
const row = paper_id => ({ paper_id, study_design: 'Randomized trial', dataset: '90 adults', findings: 'The record reports an improvement.', limitations: 'Not reported in the available record.' });

test('EYRA prompt contains only selected source records and warns against inference', () => {
  const prompt = buildEvidenceMatrixPrompt('Does treatment improve outcome?', selected.slice(0, 1));
  assert.match(prompt, /Do not create sources, citations, identifiers/);
  assert.match(prompt, /paper-1/);
  assert.doesNotMatch(prompt, /paper-2/);
  assert.doesNotMatch(prompt, /10\.1234\/example.*https:\/\/doi\.org/);
  assert.deepEqual(EVIDENCE_MATRIX_SCHEMA.required, ['rows']);
});

test('accepts only complete draft rows tied to the selected records', () => {
  const valid = validateEvidenceMatrixDraft({ rows: [row('paper-1'), row('paper-2')] }, selected);
  assert.equal(valid.length, 2);
  assert.equal(valid[0].paper_id, 'paper-1');
  assert.equal(valid[0].findings, 'The record reports an improvement.');
});

test('rejects fabricated, duplicated, missing, and malformed source rows', () => {
  assert.throws(() => validateEvidenceMatrixDraft({ rows: [row('fabricated'), row('paper-2')] }, selected), /source reference/);
  assert.throws(() => validateEvidenceMatrixDraft({ rows: [row('paper-1'), row('paper-1')] }, selected), /source reference/);
  assert.throws(() => validateEvidenceMatrixDraft({ rows: [row('paper-1')] }, selected), /every selected publication/);
  assert.throws(() => validateEvidenceMatrixDraft({ rows: [{ ...row('paper-1'), findings: null }, row('paper-2')] }, selected), /invalid matrix field/);
});

test('CSV contains real source provenance and editable draft and researcher fields', () => {
  const csv = exportEvidenceMatrixStudioCsv({
    question: 'Does treatment improve outcome?',
    rows: [{ paper: selected[0], draft: row('paper-1'), notes: { findings: '=HYPERLINK("unsafe")' } }],
  });
  assert.match(csv, /Verified source URL/);
  assert.match(csv, /https:\/\/doi\.org\/10\.1234\/example/);
  assert.match(csv, /Study design \(editable EYRA draft\)/);
  assert.match(csv, /Key findings \(researcher note\)/);
  assert.match(csv, /'=HYPERLINK/);
});
