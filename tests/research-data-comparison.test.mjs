import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareResearchNumericColumns,
  exportResearchDataComparisonCsv,
  exportResearchDataSummaryCsv,
  parseResearchCsv,
  summarizeResearchData,
  summarizeResearchNumericByCategory,
} from '../src/lib/research-data.mjs';

test('pairwise Pearson r uses complete numeric pairs and reports skipped rows', () => {
  const dataset = parseResearchCsv('hours,score\n1,2\n2,4\n3,6\n,8\n5,not recorded');
  const result = compareResearchNumericColumns(dataset, 'hours', 'score', { minimumCellSize: 1 });
  assert.equal(result.available, true);
  assert.equal(result.kind, 'pearson-correlation');
  assert.equal(result.firstColumn, 'hours');
  assert.equal(result.secondColumn, 'score');
  assert.equal(result.pairs, 3);
  assert.equal(result.incomplete, 2);
  assert.equal(result.pearsonR, 1);
  assert.deepEqual(result.scatterSample.map(point => point.row), [1, 2, 3]);
});

test('pairwise comparison detects a negative linear association without inference claims', () => {
  const dataset = parseResearchCsv('x,y\n1,8\n2,6\n3,4\n4,2');
  const result = compareResearchNumericColumns(dataset, 'x', 'y', { minimumCellSize: 1 });
  assert.equal(result.available, true);
  assert.equal(result.pearsonR, -1);
  assert.equal('pValue' in result, false);
});

test('pairwise comparison explains insufficient or constant data', () => {
  const insufficient = compareResearchNumericColumns(parseResearchCsv('x,y\n1,2\n2,4'), 'x', 'y', { minimumCellSize: 1 });
  assert.equal(insufficient.available, false);
  assert.match(insufficient.reason, /At least 3 complete/);

  const constant = compareResearchNumericColumns(parseResearchCsv('x,y\n1,2\n1,4\n1,6'), 'x', 'y', { minimumCellSize: 1 });
  assert.equal(constant.available, false);
  assert.match(constant.reason, /no variation/);
});

test('pairwise comparison rejects invalid or identical column selections', () => {
  const dataset = parseResearchCsv('x,y\n1,2\n2,4\n3,6');
  assert.equal(compareResearchNumericColumns(dataset, 'x', 'x', { minimumCellSize: 1 }).available, false);
  assert.equal(compareResearchNumericColumns(dataset, 'x', 'missing', { minimumCellSize: 1 }).available, false);
});

test('pairwise correlation remains finite for very large finite observations', () => {
  const dataset = parseResearchCsv('x,y\n1e308,1e308\n5e307,5e307\n-1e308,-1e308');
  const result = compareResearchNumericColumns(dataset, 'x', 'y', { minimumCellSize: 1 });
  assert.equal(result.available, true);
  assert.equal(result.pearsonR, 1);
});

test('comparison CSV exports aggregates only and protects formula-like column names', () => {
  const result = compareResearchNumericColumns(parseResearchCsv('=group,score\n1,2\n2,4\n3,6'), '=group', 'score', { minimumCellSize: 1 });
  const csv = exportResearchDataComparisonCsv(result);
  assert.match(csv, /"'=group"/);
  assert.match(csv, /"Pearson correlation \(r\)","1"/);
  assert.match(csv, /"Complete pairs used","3"/);
  assert.match(csv, /no p-value, population inference, or causal claim/);
  assert.doesNotMatch(csv, /\r?\n"1","2"/);
});

test('scatter sample is bounded, deterministic, and insensitive to source-row order', () => {
  const rows = Array.from({ length: 1200 }, (_, index) => `${index},${index * 2}`).join('\n');
  const result = compareResearchNumericColumns(parseResearchCsv(`x,y\n${rows}`), 'x', 'y', { minimumCellSize: 1 });
  assert.equal(result.pairs, 1200);
  assert.equal(result.scatterSample.length, 500);
  assert.equal(result.scatterSampleSize, 500);
  assert.match(result.samplingMethod, /value-hash priority sample/);
  assert.ok(result.scatterSample.every(point => point.xPosition >= 0 && point.xPosition <= 1
    && point.yPosition >= 0 && point.yPosition <= 1));
  const reversed = compareResearchNumericColumns(parseResearchCsv(`x,y\n${rows.split('\n').reverse().join('\n')}`), 'x', 'y', { minimumCellSize: 1 });
  const sampleValues = value => value.scatterSample.map(({ first, second }) => [first, second]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(sampleValues(result), sampleValues(reversed));
  assert.equal(result.pearsonR, 1, 'the full dataset correlation is unaffected by visualization sampling');
});

test('numeric-by-category summaries include observed groups and skip incomplete pairs', () => {
  const dataset = parseResearchCsv('group,score\ncontrol,1\ncontrol,3\ntreatment,5\ntreatment,7\n,9\nunknown,');
  const result = summarizeResearchNumericByCategory(dataset, 'score', 'group', { minimumGroupSize: 1 });
  assert.equal(result.available, true);
  assert.equal(result.kind, 'numeric-by-category');
  assert.equal(result.pairs, 4);
  assert.equal(result.incomplete, 2);
  assert.equal(result.totalGroups, 2);
  assert.deepEqual(result.groups.map(group => [group.category, group.count, group.mean, group.median, group.min, group.max]), [
    ['control', 2, 2, 2, 1, 3],
    ['treatment', 2, 6, 6, 5, 7],
  ]);
  assert.equal('pValue' in result, false);
});

test('numeric-by-category comparison validates column types and bounds high-cardinality output', () => {
  const invalid = summarizeResearchNumericByCategory(parseResearchCsv('x,y\n1,A\n2,B\n3,C'), 'x', 'other');
  assert.equal(invalid.available, false);

  const rows = Array.from({ length: 51 }, (_, index) => `group-${index},${index + 1}`).join('\n');
  const result = summarizeResearchNumericByCategory(parseResearchCsv(`category,value\n${rows}`), 'value', 'category', { minimumGroupSize: 1 });
  assert.equal(result.totalGroups, 51);
  assert.equal(result.groups.length, 50);
  assert.equal(result.omittedGroups, 1);
  assert.equal(result.omittedObservations, 1);
  const displayedCategories = new Set(result.groups.map(group => group.category));
  const omittedCategory = Array.from({ length: 51 }, (_, index) => `group-${index}`).find(category => !displayedCategories.has(category));
  assert.ok(omittedCategory);
  assert.equal(result.groups.some(group => group.category === omittedCategory), false);
  assert.equal(exportResearchDataComparisonCsv(result).includes(omittedCategory), false);
});

test('grouped comparison CSV exports bounded aggregates without source rows', () => {
  const grouped = summarizeResearchNumericByCategory(parseResearchCsv('=group,score\ncontrol,1\ncontrol,3'), 'score', '=group', { minimumGroupSize: 1 });
  const csv = exportResearchDataComparisonCsv(grouped);
  assert.match(csv, /"'=group"/);
  assert.match(csv, /"Category","Count","Mean","Median","Sample SD","Minimum","Maximum"/);
  assert.match(csv, /"control","2","2","2","1\.414/);
  assert.doesNotMatch(csv, /\r?\n"control","1"/);
  assert.match(csv, /no group test, population inference, or causal claim/);
});

test('correlation handles zero linear association in a nonlinear U-shaped relationship', () => {
  const result = compareResearchNumericColumns(parseResearchCsv('x,y\n-1,1\n0,0\n1,1'), 'x', 'y', { minimumCellSize: 1 });
  assert.equal(result.available, true);
  assert.equal(result.pearsonR, 0);
});

test('correlation matches an independently calculated outlier-sensitive Pearson value', () => {
  const result = compareResearchNumericColumns(parseResearchCsv('x,y\n1,2\n2,4\n3,6\n4,8\n5,100'), 'x', 'y', { minimumCellSize: 1 });
  assert.ok(Math.abs(result.pearsonR - (200 / Math.sqrt(72_400))) < 1e-12);
  assert.equal(result.pairs, 5);
});

test('very small finite values retain correlation and finite descriptive summaries', () => {
  const dataset = parseResearchCsv('x,y\n1e-300,2e-300\n2e-300,4e-300\n3e-300,6e-300');
  const result = compareResearchNumericColumns(dataset, 'x', 'y', { minimumCellSize: 1 });
  const [summary] = summarizeResearchData(dataset, { minimumCellSize: 1 });
  assert.equal(result.pearsonR, 1);
  assert.equal(summary.statistics.mean, 2e-300);
  assert.ok(Number.isFinite(summary.statistics.sampleStandardDeviation));
});

test('summary moments avoid overflow for large values and use a safe even-sample median', () => {
  const [summary] = summarizeResearchData(parseResearchCsv('x\n1e308\n1e308\n1e308'), { minimumCellSize: 1 });
  assert.equal(summary.statistics.mean, 1e308);
  assert.equal(summary.statistics.median, 1e308);
  const [wideMedian] = summarizeResearchData(parseResearchCsv('x\n1e308\n1.7e308'), { minimumCellSize: 1 });
  assert.equal(wideMedian.statistics.median, 1.35e308);
});

test('configurable small-cell suppression masks singleton summaries and grouped CSV values', () => {
  const dataset = parseResearchCsv('group,value\nunique,987654321\ncommon,1\ncommon,2\ncommon,3\ncommon,4\ncommon,5');
  const [groupSummary, numericSummary] = summarizeResearchData(dataset, { minimumCellSize: 5 });
  assert.equal(groupSummary.type, 'text');
  assert.equal(numericSummary.statisticsSuppressed, false);
  const grouped = summarizeResearchNumericByCategory(dataset, 'value', 'group', { minimumGroupSize: 5 });
  assert.equal(grouped.hasSuppressedGroups, true);
  assert.equal(grouped.totalGroups, null);
  assert.equal(grouped.pairs, null);
  assert.deepEqual(grouped.groups.map(group => group.category), ['common']);
  const csv = exportResearchDataComparisonCsv(grouped);
  assert.match(csv, /Small groups suppressed/);
  assert.equal(csv.includes('unique'), false);
  assert.equal(csv.includes('987654321'), false);
  const suppressed = summarizeResearchNumericByCategory(parseResearchCsv('group,value\none,987654321'), 'value', 'group');
  assert.equal(suppressed.available, true);
  assert.deepEqual(suppressed.groups, []);
  assert.match(suppressed.reason, /below the selected minimum/);
});

test('summary helpers default to the documented k=5 disclosure threshold', () => {
  const [summary] = summarizeResearchData(parseResearchCsv('value\n7654321\n2\n3\n4'));
  assert.equal(summary.minimumCellSize, 5);
  assert.equal(summary.statisticsSuppressed, true);
  assert.equal(summary.statistics, null);
  const csv = exportResearchDataSummaryCsv([summary]);
  assert.match(csv, /"value","numeric","5","Suppressed: below minimum cell size","","",""/);
  assert.equal(csv.includes('7654321'), false);
});

test('numeric summary CSV masks all small-cell counts and statistics', () => {
  const dataset = parseResearchCsv('value\n7654321\n');
  const summaryCsv = exportResearchDataSummaryCsv(summarizeResearchData(dataset, { minimumCellSize: 5 }));
  assert.match(summaryCsv, /Suppressed: below minimum cell size/);
  assert.match(summaryCsv, /Minimum cell size \(k\)/);
  assert.equal(summaryCsv.includes('7654321'), false);
  assert.match(summaryCsv, /"value","numeric","5","Suppressed: below minimum cell size","","",""/);
});

test('group summaries preserve unequal counts and skewed-distribution descriptive values', () => {
  const dataset = parseResearchCsv('group,value\nA,1\nA,1\nA,1\nA,1\nA,100\nB,8\nB,10\nB,16');
  const result = summarizeResearchNumericByCategory(dataset, 'value', 'group', { minimumGroupSize: 1 });
  assert.deepEqual(result.groups.map(({ category, count, mean, median, min, max }) => [category, count, mean, median, min, max]), [
    ['A', 5, 20.8, 1, 1, 100],
    ['B', 3, 11.333333333333334, 10, 8, 16],
  ]);
});

test('correlation disclosure threshold is user controlled and masks too-small pair sets', () => {
  const dataset = parseResearchCsv('x,y\n1,2\n2,4\n3,6');
  const defaultResult = compareResearchNumericColumns(dataset, 'x', 'y');
  assert.equal(defaultResult.available, false);
  assert.equal(defaultResult.pairs, 3);
  assert.match(defaultResult.reason, /selected disclosure threshold/);
  assert.equal(compareResearchNumericColumns(dataset, 'x', 'y', { minimumCellSize: 1 }).pearsonR, 1);
});

test('correlation CSV labels its deterministic visualization sample as non-representative', () => {
  const dataset = parseResearchCsv('x,y\n1,2\n2,4\n3,6');
  const result = compareResearchNumericColumns(dataset, 'x', 'y');
  const csv = exportResearchDataComparisonCsv(result);
  assert.match(csv, /Visualization sample only; not statistically representative/);
  assert.match(csv, /all complete pairs/);
});

test('comparison export is rectangular valid CSV and documents disclosure limits', () => {
  const result = summarizeResearchNumericByCategory(parseResearchCsv('g,x\nA,1\nA,2\nA,3'), 'x', 'g', { minimumGroupSize: 1 });
  const csv = exportResearchDataComparisonCsv(result);
  const parsed = parseResearchCsv(csv);
  assert.ok(parsed.rows.every(row => row.length === 7));
  assert.match(csv, /Aggregate output does not guarantee anonymity/);
});
