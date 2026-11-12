import test from 'node:test';
import assert from 'node:assert/strict';
import { getFundingComparisonRecords, toggleFundingComparisonSelection } from '../src/lib/funding-comparison.mjs';

test('funding comparison allows at most three source records and supports removal', () => {
  let selected = [];
  selected = toggleFundingComparisonSelection(selected, 'call-1');
  selected = toggleFundingComparisonSelection(selected, 'call-2');
  selected = toggleFundingComparisonSelection(selected, 'call-3');
  assert.deepEqual(selected, ['call-1', 'call-2', 'call-3']);
  assert.equal(toggleFundingComparisonSelection(selected, 'call-4'), null);
  assert.deepEqual(toggleFundingComparisonSelection(selected, 'call-2'), ['call-1', 'call-3']);
});

test('comparison displays only selected records still present in live results', () => {
  const records = [
    { id: 'call-1', title: 'Official call one' },
    { id: 'call-2', title: 'Official call two' },
  ];
  assert.deepEqual(
    getFundingComparisonRecords(records, ['call-2', 'deleted-call']),
    [records[1]],
  );
});

test('invalid selection input cannot add a comparison item', () => {
  assert.equal(toggleFundingComparisonSelection([], ''), null);
  assert.equal(toggleFundingComparisonSelection(null, 'call-1').length, 1);
});
