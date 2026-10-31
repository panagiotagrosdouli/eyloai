import test from 'node:test';
import assert from 'node:assert/strict';

import { countAvailablePaperIndexes, PAPER_INDEX_SOURCE_IDS } from '../src/lib/discovery-source-status.js';

test('paper-index availability excludes researcher and institution endpoints', () => {
  const sources = [
    { id: 'openalex', status: 'available' },
    { id: 'arxiv', status: 'available' },
    { id: 'europe_pmc', status: 'unavailable' },
    { id: 'crossref', status: 'available' },
    { id: 'semantic_scholar', status: 'unavailable' },
    { id: 'researchers', status: 'available' },
    { id: 'institutions', status: 'available' },
  ];

  assert.equal(PAPER_INDEX_SOURCE_IDS.length, 5);
  assert.equal(countAvailablePaperIndexes(sources), 3);
});

test('paper-index availability fails closed for missing or aggregate-only status', () => {
  assert.equal(countAvailablePaperIndexes([]), 0);
  assert.equal(countAvailablePaperIndexes([
    { id: 'paper_indexes', status: 'unavailable' },
    { id: 'researchers', status: 'available' },
    { id: 'institutions', status: 'available' },
  ]), 0);
});
