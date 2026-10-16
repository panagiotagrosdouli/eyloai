import test from 'node:test';
import assert from 'node:assert/strict';
import { traceableGapHypotheses } from '../src/lib/research-provenance.mjs';

test('never outputs uncited or invented literature-gap claims', () => {
  assert.deepEqual(traceableGapHypotheses(['No evidence', 'Hypothesis [P99]', 'Possible gap [P1]'], 1), ['Possible gap [P1]']);
});

test('rejects missing and invalid citations even if another citation is valid', () => {
  assert.deepEqual(traceableGapHypotheses(['Gap [P1] [P0]', 'Gap [P1] [P13]', 'Gap [P2]'], 2), ['Gap [P2]']);
});

test('rejects gaps without retrieved literature and handles malformed input', () => {
  assert.deepEqual(traceableGapHypotheses(['Maybe [P1]'], 0), []);
  assert.deepEqual(traceableGapHypotheses(null, 10), []);
  assert.deepEqual(traceableGapHypotheses([null, 4, ' '], 10), []);
});

test('only first twelve supplied context papers can be cited', () => {
  assert.deepEqual(traceableGapHypotheses(['Supported by sample [P12]', 'Not in sample [P13]'], 100), ['Supported by sample [P12]']);
});
