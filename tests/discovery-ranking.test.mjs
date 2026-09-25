import test from 'node:test';
import assert from 'node:assert/strict';

import { rankPaperRecords } from '../src/lib/eyra-api.js';

const profile = {
  level: 'researcher',
  goal: 'review',
  recency: 'balanced',
  limit: 20,
};

test('deduplicates DOI versions across scholarly sources', () => {
  const records = [
    {
      id: 'openalex-1',
      doi: '10.1000/example.v2',
      title: 'Federated learning privacy in hospitals',
      summary: 'Federated learning privacy methods for hospitals.',
      year: 2025,
      cited_by_count: 25,
      source_index: 'OpenAlex',
      relevance_score: 0.95,
    },
    {
      id: 'crossref-1',
      doi: 'https://doi.org/10.1000/example',
      title: 'Federated learning privacy in hospitals',
      summary: 'Federated learning privacy methods for hospitals.',
      year: 2025,
      cited_by_count: 20,
      source_index: 'Crossref',
      relevance_score: 0.9,
    },
  ];

  const ranked = rankPaperRecords(records, 'federated learning privacy', profile);
  assert.equal(ranked.length, 1);
});

test('filters table, figure and supplementary child records', () => {
  const records = [
    {
      id: 'paper',
      title: 'Federated learning privacy for clinical collaboration',
      summary: 'Federated learning privacy for clinical collaboration.',
      year: 2024,
      source_index: 'OpenAlex',
      relevance_score: 0.9,
    },
    {
      id: 'table',
      title: 'Table 1: Federated learning privacy for clinical collaboration',
      summary: 'Federated learning privacy for clinical collaboration.',
      year: 2024,
      source_index: 'Crossref',
      relevance_score: 0.99,
    },
  ];

  const ranked = rankPaperRecords(records, 'federated learning privacy', profile);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, 'paper');
});

test('promotes review literature as a start-here record for beginners', () => {
  const records = [
    {
      id: 'survey',
      title: 'A survey of quantum computing drug discovery',
      summary: 'Quantum computing drug discovery methods and evidence.',
      year: 2024,
      cited_by_count: 80,
      open_access: true,
      source_index: 'OpenAlex',
      relevance_score: 0.95,
    },
    {
      id: 'study',
      title: 'Quantum computing drug discovery experiments',
      summary: 'Quantum computing drug discovery experiments and results.',
      year: 2025,
      cited_by_count: 5,
      source_index: 'Semantic Scholar',
      relevance_score: 0.9,
    },
  ];

  const ranked = rankPaperRecords(records, 'quantum computing drug discovery', {
    level: 'beginner',
    goal: 'understand',
    recency: 'balanced',
    limit: 10,
  });

  assert.ok(ranked.some(record => record.id === 'survey' && record.discovery_category === 'start_here'));
});

test('rejects records that negate the lead research concept', () => {
  const records = [
    {
      id: 'positive',
      title: 'Federated learning privacy for hospital AI',
      summary: 'Federated learning privacy approaches for hospital AI.',
      year: 2025,
      source_index: 'OpenAlex',
      relevance_score: 0.9,
    },
    {
      id: 'negative',
      title: 'Hospital AI without federated learning privacy',
      summary: 'An architecture without federated learning privacy.',
      year: 2025,
      source_index: 'Crossref',
      relevance_score: 0.99,
    },
  ];

  const ranked = rankPaperRecords(records, 'federated learning privacy', profile);
  assert.deepEqual(ranked.map(record => record.id), ['positive']);
});
