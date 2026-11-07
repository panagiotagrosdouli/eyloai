import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRecordId, precisionAtK, dcgAtK, ndcgAtK, evaluateQuery, summarize } from '../scripts/lib/discovery-metrics.mjs';

test('precision@5 divides by five even when fewer records were returned', () => {
  assert.equal(precisionAtK([2, 2, 0]), 0.4);
  assert.equal(precisionAtK([2, 2, 2, 2, 2]), 1);
});
test('graded nDCG equals one for ideal ranking and decreases for inversions', () => {
  assert.equal(ndcgAtK([2, 1, 0], [2, 1, 0]), 1);
  assert.ok(ndcgAtK([0, 1, 2], [2, 1, 0]) < 1);
  assert.equal(ndcgAtK([0, 0], [0, 0]), 0);
  assert.ok(dcgAtK([2, 1]) > dcgAtK([1, 2]));
});
test('canonical DOI normalizes resolver URLs without losing version suffix', () => {
  assert.equal(canonicalRecordId({ doi: 'HTTPS://DOI.ORG/10.1000/ABC.v2' }), 'doi:10.1000/abc.v2');
  assert.equal(canonicalRecordId({ id: 'OPENALEX:W123' }), 'id:openalex:w123');
});
test('evaluation refuses unjudged returned records instead of counting them as irrelevant', () => {
  assert.throws(() => evaluateQuery({ results: [{ id: 'a' }], judgments: [] }), /Unjudged/);
});
test('evaluation detects duplicate judgments and wrong grades', () => {
  assert.throws(() => evaluateQuery({ results: [], judgments: [
    { record_id: 'id:a', grade: 2 }, { record_id: 'id:a', grade: 1 },
  ] }), /Duplicate/);
  assert.throws(() => evaluateQuery({ results: [], judgments: [
    { record_id: 'id:a', grade: null },
  ] }), /Grades/);
});
test('evaluation computes precision, normalized gain and duplicate rate', () => {
  const rows = [{ id: 'A', source_index: 'OpenAlex' }, { id: 'A', source_index: 'OpenAlex' }, { id: 'B', source_index: 'Crossref' }];
  const judged = [{ record_id: 'id:a', grade: 2 }, { record_id: 'id:b', grade: 1 }];
  const result = evaluateQuery({ results: rows, judgments: judged });
  assert.equal(result.precision_at_5, 0.4);
  assert.equal(result.duplicates_at_10, 1);
  assert.equal(result.sources_at_10, 2);
});
test('summary reports mean values without treating missing cases as success', () => {
  const s = summarize([{ precision_at_5: 1, ndcg_at_10: 0.5, zero_results: false }, { precision_at_5: 0, ndcg_at_10: 0, zero_results: true }]);
  assert.equal(s.precision_at_5, 0.5);
  assert.equal(s.zero_result_rate, 0.5);
});
