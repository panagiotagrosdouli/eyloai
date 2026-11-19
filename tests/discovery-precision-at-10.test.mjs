import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateQuery, summarize } from '../scripts/lib/discovery-metrics.mjs';

const records = Array.from({ length: 10 }, (_, index) => ({
  id: 'W' + (index + 1),
  title: 'Frozen synthetic paper ' + (index + 1),
  source_index: index % 2 ? 'Crossref' : 'OpenAlex',
}));
const labels = records.map((record, index) => ({
  record_id: 'id:' + record.id.toLowerCase(),
  grade: index < 3 ? 2 : 0,
}));

test('P@5 and P@10 keep fixed denominators for the same independently graded corpus', () => {
  const row = evaluateQuery({ results: records, judgments: labels });
  assert.equal(row.precision_at_5, 3 / 5);
  assert.equal(row.precision_at_10, 3 / 10);
  assert.equal(row.judged_at_10, 10);
  assert.equal(row.sources_at_10, 2);
  const report = summarize([row, row]);
  assert.equal(report.queries, 2);
  assert.equal(report.precision_at_5, 3 / 5);
  assert.equal(report.precision_at_10, 3 / 10);
});

test('fewer than ten results do not inflate Precision@10 by shrinking its denominator', () => {
  const row = evaluateQuery({ results: records.slice(0, 3), judgments: labels.slice(0, 3) });
  assert.equal(row.precision_at_5, 3 / 5);
  assert.equal(row.precision_at_10, 3 / 10);
});

test('duplicate publication identity earns no second relevance credit', () => {
  const duplicate = { ...records[0], title: 'Same DOI and record indexed twice' };
  const row = evaluateQuery({
    results: [records[0], duplicate, ...records.slice(1, 9)],
    judgments: labels,
  });
  assert.equal(row.duplicates_at_10, 1);
  assert.equal(row.precision_at_10, 3 / 10);
});

test('unjudged top-ten results cannot be silently treated as irrelevant', () => {
  assert.throws(() => evaluateQuery({ results: records, judgments: labels.slice(0, 9) }), /Unjudged top-10 records/);
});
