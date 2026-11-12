import test from 'node:test';
import assert from 'node:assert/strict';
import { auditResearchDataQuality } from '../src/lib/research-data-quality.mjs';

test('calculates exact missingness, complete cases and descriptive percentages', () => {
  const audit = auditResearchDataQuality({
    headers: ['Age', 'Group', 'Notes'],
    rows: [['20', 'A', ''], ['21', '', 'ok'], ['21', 'A', 'ok'], ['21', 'A', 'ok']],
  });
  assert.equal(audit.totalRows, 4);
  assert.equal(audit.columnCount, 3);
  assert.equal(audit.completeRows, 2);
  assert.equal(audit.incompleteRows, 2);
  assert.equal(audit.identicalAdditionalRows, 1);
  assert.deepEqual(audit.columns.map(item => item.missing), [0, 1, 1]);
  assert.equal(audit.columns[1].missingPercent, 25);
  assert.match(audit.disclaimer, /No data were changed/);
});

test('recognizes blank and whitespace-only cells without interpreting numeric zero as missing', () => {
  const audit = auditResearchDataQuality({
    headers: ['X', 'Y'],
    rows: [['0', ' '], ['', '0'], ['\t', '']],
  });
  assert.equal(audit.completeRows, 0);
  assert.equal(audit.entirelyMissingRows, 1);
  assert.equal(audit.columns[0].present, 1);
  assert.equal(audit.columns[1].present, 1);
});

test('flags all-missing or constant columns but makes no statistical inferences', () => {
  const audit = auditResearchDataQuality({
    headers: ['all_missing', 'constant'],
    rows: [['', 'same'], ['', 'same']],
  });
  assert.equal(audit.columns[0].allMissing, true);
  assert.equal(audit.columns[1].constantAmongPresent, true);
  assert.ok(audit.notes.some(note => /no observed values/.test(note)));
  assert.ok(audit.notes.some(note => /only one observed/.test(note)));
  assert.equal('pValue' in audit, false);
});

test('handles empty and malformed input without division by zero', () => {
  const audit = auditResearchDataQuality({ headers: ['A'], rows: [] });
  assert.equal(audit.columns[0].missingPercent, 0);
  assert.equal(audit.completeRows, 0);
  assert.equal(audit.incompleteRows, 0);
  assert.equal(audit.identicalAdditionalRows, 0);
});
