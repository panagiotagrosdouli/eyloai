import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEyraCitationIds } from '../src/lib/eyra-citation-ids.mjs';

const sources = [
  { id: 'P1', title: 'Publication 1', url: 'https://openalex.org/W100' },
  { id: 'P2', title: 'Publication 2', url: 'https://openalex.org/W200' },
  { id: 'F1', title: 'Official grant', url: 'https://example.edu/opportunity' },
];

test('only sources explicitly referenced in answer appear as citations', () => {
  const result = checkEyraCitationIds('Methodological caveat [P2]; eligibility requires review [F1].', sources);
  assert.deepEqual(result.invalidIds, []);
  assert.deepEqual(result.citedIds, ['P2', 'F1']);
  assert.deepEqual(result.citedSources.map(source => source.id), ['P2', 'F1']);
  assert.equal(result.valid, true);
});

test('invented model citation IDs must not be treated as retrieved evidence', () => {
  const result = checkEyraCitationIds('This is certain [P99]. See [R3] and [P1].', sources);
  assert.equal(result.valid, false);
  assert.deepEqual(result.invalidIds, ['P99', 'R3']);
  assert.deepEqual(result.citedSources.map(source => source.id), ['P1']);
});

test('no reference is never silently assigned to every retrieved source', () => {
  const result = checkEyraCitationIds('General methodological guidance, no indexed citations.', sources);
  assert.equal(result.valid, true);
  assert.deepEqual(result.citedSources, []);
});
