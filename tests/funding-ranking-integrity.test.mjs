import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFundingRanking } from '../src/lib/funding-ranking.mjs';

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
    match_reason: '',
    difficulty: 'Unranked',
  }]);
});

test('malformed ranking entries are ignored without adding or changing source records', () => {
  const records = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  const result = applyFundingRanking(records, {
    ranked: [null, [], { id: 12, match_score: 99 }, { id: 'unknown', match_score: 100 }],
  });
  assert.deepEqual(result.map(({ id, title, match_score, difficulty }) => ({ id, title, match_score, difficulty })), [
    { id: 'a', title: 'A', match_score: null, difficulty: 'Unranked' },
    { id: 'b', title: 'B', match_score: null, difficulty: 'Unranked' },
  ]);
});

test('the first ranking for a known ID wins deterministically', () => {
  const records = [{ id: 'a', title: 'A' }];
  const result = applyFundingRanking(records, {
    ranked: [
      { id: 'a', match_score: 42, match_reason: 'First estimate', difficulty: 'Low' },
      { id: 'a', match_score: 99, match_reason: 'Duplicate estimate', difficulty: 'High' },
    ],
  });
  assert.equal(result[0].match_score, 42);
  assert.equal(result[0].match_reason, 'First estimate');
  assert.equal(result[0].difficulty, 'Low');
});

test('partial rankings leave unranked records explicitly unscored after scored records', () => {
  const records = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }];
  const result = applyFundingRanking(records, { ranked: [{ id: 'b', match_score: 73, difficulty: 'Medium' }] });
  assert.deepEqual(result.map(({ id, match_score, difficulty }) => ({ id, match_score, difficulty })), [
    { id: 'b', match_score: 73, difficulty: 'Medium' },
    { id: 'a', match_score: null, difficulty: 'Unranked' },
    { id: 'c', match_score: null, difficulty: 'Unranked' },
  ]);
});

test('ranking explanations remain plain bounded text', () => {
  const result = applyFundingRanking([{ id: 'a', title: 'A' }], {
    ranked: [{ id: 'a', match_score: 50, match_reason: '<img src=x onerror=alert(1)>\u0000 matches topic', difficulty: 'High' }],
  });
  assert.equal(result[0].match_reason, '<img src=x onerror=alert(1)> matches topic');
});
