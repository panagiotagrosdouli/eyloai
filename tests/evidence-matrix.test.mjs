import test from 'node:test';
import assert from 'node:assert/strict';
import { exportEvidenceMatrixCsv, getEvidenceMatrixRows, NOTE_FIELDS } from '../src/lib/evidence-matrix.mjs';

const papers = [
  { id: 'a', title: 'A "quoted" paper', authors: 'Lee, Kim', year: 2024, url: 'https://doi.org/10/a' },
  { id: 'b', title: 'Second paper', authors: 'Rao', year: 2021, url: 'https://openalex.org/W2' },
];

test('matrix rows contain only selected saved papers and their manual notes', () => {
  const rows = getEvidenceMatrixRows(papers, ['b', 'unknown', 'b'], { b: { findings: 'Mixed results' } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paper, papers[1]);
  assert.equal(rows[0].notes.findings, 'Mixed results');
  assert.equal(rows[0].notes.limitations, '');
});

test('matrix gracefully handles empty saved-paper data', () => {
  assert.deepEqual(getEvidenceMatrixRows(undefined, ['a']), []);
  assert.deepEqual(getEvidenceMatrixRows(papers, undefined), []);
});

test('CSV export preserves quotes and escapes spreadsheet formulas', () => {
  const rows = getEvidenceMatrixRows(papers, ['a'], { a: { study_design: '=HYPERLINK("x")', findings: 'Uses "matched" controls' } });
  const csv = exportEvidenceMatrixCsv(rows);
  assert.match(csv, /"A ""quoted"" paper"/);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.match(csv, /"Uses ""matched"" controls"/);
  assert.equal(NOTE_FIELDS.length, 4);
});
