import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterFundingOpportunities,
  formatFundingComparisonValue,
  getFundingComparisonRecords,
  isSafeFundingSourceUrl,
  toggleFundingComparisonSelection,
} from '../src/lib/funding-comparison.mjs';

test('funding comparison selection is unique, removable, and capped at three', () => {
  let selected = [];
  selected = toggleFundingComparisonSelection(selected, 'call-1');
  selected = toggleFundingComparisonSelection(selected, 'call-2');
  selected = toggleFundingComparisonSelection(selected, 'call-3');
  assert.deepEqual(selected, ['call-1', 'call-2', 'call-3']);
  assert.equal(toggleFundingComparisonSelection(selected, 'call-4'), null);
  assert.deepEqual(toggleFundingComparisonSelection(selected, 'call-2'), ['call-1', 'call-3']);
  assert.deepEqual(toggleFundingComparisonSelection(['call-1', 'call-1'], 'call-2'), ['call-1', 'call-2']);
});

test('comparison includes only selected records that survive the active filters', () => {
  const records = [
    { id: 'us', title: 'US grant', type: 'grant', country: 'US', deadline_days: 30, categories: ['climate'] },
    { id: 'eu', title: 'EU call', type: 'call', country: 'Europe', deadline_days: 100, categories: ['energy'] },
    { id: 'expired', title: 'Expired grant', type: 'grant', country: 'US', deadline_days: -1, categories: [] },
  ];
  const filtered = filterFundingOpportunities(records, { category: 'grant', deadline: 'active', field: 'climate' });
  assert.deepEqual(filtered.map((record) => record.id), ['us']);
  assert.deepEqual(getFundingComparisonRecords(filtered, ['us', 'eu', 'expired']), [records[0]]);
  assert.deepEqual(getFundingComparisonRecords([], ['us']), []);
});

test('filtering handles provider arrays and structured eligibility safely', () => {
  const records = [{
    id: 'eu', title: 'European call', type: 'call', deadline_days: null,
    categories: ['Climate research', 'Adaptation'],
    instruments: [{ name: 'Research and innovation action' }],
    eligibility: { applicants: ['Universities', 'Research institutes'] },
    country: ['Greece', 'Portugal'],
  }];
  assert.equal(filterFundingOpportunities(records, { field: 'adaptation' }).length, 1);
  assert.equal(filterFundingOpportunities(records, { field: 'innovation action' }).length, 1);
  assert.equal(filterFundingOpportunities(records, { country: 'portugal' }).length, 1);
  assert.equal(filterFundingOpportunities(records, { country: 'universities' }).length, 1);
  assert.equal(filterFundingOpportunities(records, { deadline: 'active' }).length, 1);
});

test('structured values render as readable plain text and missing values stay explicit', () => {
  assert.equal(formatFundingComparisonValue(['Climate', { budget: { currency: 'EUR', amount: 500000 } }]), 'Climate; budget: currency: EUR; amount: 500000');
  assert.equal(formatFundingComparisonValue([]), 'Not provided by source');
  assert.equal(formatFundingComparisonValue(null), 'Not provided by source');
});

test('only secure official Grants.gov and Europa URLs are linkable', () => {
  assert.equal(isSafeFundingSourceUrl('https://www.grants.gov/search-results-detail/123'), true);
  assert.equal(isSafeFundingSourceUrl('https://ec.europa.eu/info/funding-tenders/topic-details'), true);
  assert.equal(isSafeFundingSourceUrl('javascript:alert(1)'), false);
  assert.equal(isSafeFundingSourceUrl('https://grants.gov.attacker.example/call'), false);
  assert.equal(isSafeFundingSourceUrl('https://user:pass@grants.gov/call'), false);
  assert.equal(isSafeFundingSourceUrl('http://grants.gov/call'), false);
});
