import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_LAB_LIMITS,
  exportResearchDataSummaryCsv,
  getResearchDataChartRows,
  parseResearchCsv,
  summarizeResearchData,
} from '../src/lib/research-data.mjs';

test('CSV parser handles BOM, CRLF, escaped quotes and line breaks inside quoted values', () => {
  const dataset = parseResearchCsv('\uFEFFname,score,note\r\n"Smith, Jo",1,"said ""yes"""\r\nAri,2,"line one\nline two"\r\n');
  assert.deepEqual(dataset.headers, ['name', 'score', 'note']);
  assert.deepEqual(dataset.rows, [
    ['Smith, Jo', '1', 'said "yes"'],
    ['Ari', '2', 'line one\nline two'],
  ]);
});

test('CSV parser rejects malformed rows, duplicate headers and unclosed quotes', () => {
  assert.throws(() => parseResearchCsv('a,b\n1'), /different number of columns/);
  assert.throws(() => parseResearchCsv('Name,name\nA,B'), /must be unique/);
  assert.throws(() => parseResearchCsv('a\n"unfinished'), /not closed/);
  assert.throws(() => parseResearchCsv('a\n"closed"tail'), /after a quoted/);
});

test('CSV parser enforces byte, row and column bounds', () => {
  assert.throws(() => parseResearchCsv('a\n1234', { ...DATA_LAB_LIMITS, bytes: 4 }), /5 MB limit/);
  assert.throws(() => parseResearchCsv('a\n1\n2', { ...DATA_LAB_LIMITS, rows: 1 }), /10,000 data-row limit/);
  assert.throws(() => parseResearchCsv('a,b\n1,2', { ...DATA_LAB_LIMITS, columns: 1 }), /50-column limit/);
});

test('summaries count blank cells and calculate reproducible sample statistics', () => {
  const dataset = parseResearchCsv('score,label\n1,alpha\n2,\n3,beta\n,alpha\n');
  const [score, label] = summarizeResearchData(dataset, { minimumCellSize: 1 });
  assert.equal(score.type, 'numeric');
  assert.equal(score.missing, 1);
  assert.equal(score.distinct, 3);
  assert.deepEqual(score.statistics, {
    count: 3,
    mean: 2,
    median: 2,
    min: 1,
    max: 3,
    sampleStandardDeviation: 1,
  });
  assert.equal(label.type, 'text');
  assert.equal(label.missing, 1);
  assert.equal(label.distinct, 2);
  assert.equal(label.statistics, undefined);
});

test('all-missing columns are identified without inventing a text or numeric type', () => {
  const [, summary] = summarizeResearchData(parseResearchCsv('value,empty\n1,\n2,'));
  assert.equal(summary.type, 'empty');
  assert.equal(summary.missing, 2);
});

test('chart rows are numeric, skip blanks and obey the requested cap', () => {
  const dataset = parseResearchCsv('value\n1\n\n2\n3');
  assert.deepEqual(getResearchDataChartRows(dataset, 'value', 2), [{ row: 1, value: 1 }, { row: 2, value: 2 }]);
  assert.deepEqual(getResearchDataChartRows(dataset, 'unknown'), []);
});

test('summary CSV quotes cells, protects formulas and retains negative numeric results', () => {
  const summary = summarizeResearchData(parseResearchCsv('metric,=danger,"A ""quote"""\n-4,2,x\n-2,3,y'), { minimumCellSize: 1 });
  const csv = exportResearchDataSummaryCsv(summary);
  assert.match(csv, /"'=danger"/);
  assert.match(csv, /"A ""quote"""/);
  assert.match(csv, /,"-4"/);
  assert.match(csv, /,"-2"/);
});
