import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFundingRanking } from '../src/lib/funding-api.js';

test('ranking output cannot overwrite official funding facts', () => {
  const records = [{
    id: 'grant-1',
    title: 'Official title',
    agency: 'Official agency',
    description: 'Official description',
    eligibility: 'Universities',
    deadline: '2030-12-31',
    amount: '$1,000,000',
    source_url: 'https://www.grants.gov/search-results-detail/1',
  }];

  const result = applyFundingRanking(records, {
    ranked: [{
      id: 'grant-1',
      match_score: 88,
      match_reason: 'Matches the stated research topic.',
      difficulty: 'Medium',
      title: 'Invented title',
      agency: 'Invented agency',
      eligibility: 'Everyone',
      deadline: '2099-01-01',
      amount: 'Unlimited',
      source_url: 'https://example.invalid',
    }],
  });

  assert.deepEqual(result, [{
    ...records[0],
    match_score: 88,
    match_reason: 'Matches the stated research topic.',
    difficulty: 'Medium',
  }]);
});

test('unknown IDs, invalid scores and invalid difficulty cannot become trusted ranking data', () => {
  const records = [{ id: 'grant-1', title: 'Official title' }];
  const result = applyFundingRanking(records, {
    ranked: [
      { id: 'other', match_score: 100, title: 'Injected record' },
      { id: 'grant-1', match_score: '99', match_reason: 'x'.repeat(700), difficulty: 'Guaranteed' },
    ],
  });

  assert.deepEqual(result, [{
    ...records[0],
    match_score: null,
    match_reason: 'x'.repeat(500),
    difficulty: 'Unranked',
  }]);
});
