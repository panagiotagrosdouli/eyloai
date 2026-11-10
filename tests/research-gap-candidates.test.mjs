import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResearchGapCandidates } from '../src/lib/research-gap-candidates.mjs';

const papers = [
  { title: 'Paper one', url: 'https://doi.org/10.1/example' },
  { title: 'Paper two', url: 'https://openalex.org/W2' },
];

test('maps only retrieved context and counterevidence IDs to source records', () => {
  const result = normalizeResearchGapCandidates([{
    question: 'Does method A generalize?',
    rationale: 'The retrieved records use different settings.',
    context_paper_ids: ['P1', 'P99', 'P1'],
    counterevidence_paper_ids: ['P2', 'invented'],
  }], papers);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].context.map(({ id }) => id), ['P1']);
  assert.deepEqual(result[0].counterevidence.map(({ id }) => id), ['P2']);
  assert.equal(result[0].context[0].paper, papers[0]);
});

test('omits candidates with no question or no retrieved context', () => {
  const result = normalizeResearchGapCandidates([
    { question: 'Uncited claim', context_paper_ids: ['P77'] },
    { question: '   ', context_paper_ids: ['P1'] },
    'not a structured candidate',
  ], papers);
  assert.deepEqual(result, []);
});

test('handles missing candidate and paper arrays', () => {
  assert.deepEqual(normalizeResearchGapCandidates(undefined, papers), []);
  assert.deepEqual(normalizeResearchGapCandidates([{ question: 'What next?', context_paper_ids: ['P1'] }], undefined), []);
});
