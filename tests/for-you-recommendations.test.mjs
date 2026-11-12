import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRecommendationQueries, mergeRecommendationResults, recommendationIdentity } from '../src/lib/for-you-recommendations.mjs';

test('recommendation queries come only from actual user signals and deduplicate', () => {
  const queries = deriveRecommendationQueries({
    searches: [{ query: 'CRISPR crop resilience' }, { query: 'crispr   crop resilience' }],
    activeProjects: [{ title: 'Soil microbiome', goal: 'Drought tolerance', status: 'active' }],
    user: { research_interests: 'CRISPR, plant genomics' },
  });
  assert.deepEqual(queries.map((item) => item.query), [
    'CRISPR crop resilience', 'Soil microbiome Drought tolerance', 'CRISPR',
  ]);
  assert.match(queries[1].reason, /Soil microbiome/);
});

test('does not invent default search signals for a new user', () => {
  assert.deepEqual(deriveRecommendationQueries({ searches: [], activeProjects: [], user: {} }), []);
});

test('DOI identities normalize case, DOI URLs and DOI prefixes', () => {
  assert.equal(recommendationIdentity({ doi: 'https://doi.org/10.1000/ABC' }), 'doi:10.1000/abc');
  assert.equal(recommendationIdentity({ doi: 'DOI: 10.1000/abc' }), 'doi:10.1000/abc');
});

test('merges duplicate real provider records and retains multiple user reasons', () => {
  const items = mergeRecommendationResults([
    { signal: { query: 'soil health', reason: 'From search' }, papers: [{ doi: '10.1000/abc', title: 'Soil study', source: 'OpenAlex' }] },
    { signal: { query: 'microbiome', reason: 'From project' }, papers: [{ doi: 'https://doi.org/10.1000/ABC', title: 'Soil study duplicate', abstract: 'Observed abstract', source: 'Crossref' }] },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].paper.title, 'Soil study');
  assert.equal(items[0].paper.abstract, 'Observed abstract');
  assert.deepEqual(items[0].alsoRelevantTo, [{ query: 'microbiome', reason: 'From project' }]);
});

test('ignores provider records without a title or usable identity', () => {
  const items = mergeRecommendationResults([
    { signal: { query: 'x', reason: 'search' }, papers: [{ title: '' }, { title: '   ' }, { id: 'openalex:123' }] },
  ]);
  assert.deepEqual(items, []);
});
