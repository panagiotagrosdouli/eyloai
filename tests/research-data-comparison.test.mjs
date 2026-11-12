import test from 'node:test';
import assert from 'node:assert/strict';
import { compareResearchNumericColumns, parseResearchCsv } from '../src/lib/research-data.mjs';

test('pairwise Pearson r uses complete numeric pairs and reports skipped rows', () => {
  const dataset = parseResearchCsv('hours,score\n1,2\n2,4\n3,6\n,8\n5,not recorded');
  assert.deepEqual(compareResearchNumericColumns(dataset, 'hours', 'score'), {
    available: true,
    kind: 'pearson-correlation',
    firstColumn: 'hours',
    secondColumn: 'score',
    pairs: 3,
    incomplete: 2,
    pearsonR: 1,
  });
});

test('pairwise comparison detects a negative linear association without inference claims', () => {
  const dataset = parseResearchCsv('x,y\n1,8\n2,6\n3,4\n4,2');
  const result = compareResearchNumericColumns(dataset, 'x', 'y');
  assert.equal(result.available, true);
  assert.equal(result.pearsonR, -1);
  assert.equal('pValue' in result, false);
});

test('pairwise comparison explains insufficient or constant data', () => {
  const insufficient = compareResearchNumericColumns(parseResearchCsv('x,y\n1,2\n2,4'), 'x', 'y');
  assert.equal(insufficient.available, false);
  assert.match(insufficient.reason, /At least three complete/);

  const constant = compareResearchNumericColumns(parseResearchCsv('x,y\n1,2\n1,4\n1,6'), 'x', 'y');
  assert.equal(constant.available, false);
  assert.match(constant.reason, /no variation/);
});

test('pairwise comparison rejects invalid or identical column selections', () => {
  const dataset = parseResearchCsv('x,y\n1,2\n2,4\n3,6');
  assert.equal(compareResearchNumericColumns(dataset, 'x', 'x').available, false);
  assert.equal(compareResearchNumericColumns(dataset, 'x', 'missing').available, false);
});

test('pairwise correlation remains finite for very large finite observations', () => {
  const dataset = parseResearchCsv('x,y\n1e308,1e308\n5e307,5e307\n-1e308,-1e308');
  const result = compareResearchNumericColumns(dataset, 'x', 'y');
  assert.equal(result.available, true);
  assert.equal(result.pearsonR, 1);
});
