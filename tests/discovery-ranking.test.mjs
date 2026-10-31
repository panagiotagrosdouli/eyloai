import test from 'node:test';
import assert from 'node:assert/strict';

import { rankPaperRecords } from '../src/lib/eyra-api.js';

const profile = {
  level: 'researcher',
  goal: 'review',
  recency: 'balanced',
  limit: 20,
};

test('does not collapse distinct DOI suffixes into a guessed version family', () => {
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
  assert.equal(ranked.length, 2);
  assert.deepEqual(new Set(ranked.map(record => record.doi)), new Set([
    '10.1000/example.v2',
    'https://doi.org/10.1000/example',
  ]));
});

test('deduplicates identical DOIs after URL, prefix, case, and encoding normalization', () => {
  const records = [
    {
      id: 'openalex-2',
      doi: 'https://doi.org/10.1000/ABC%2FXYZ',
      title: 'Robust graph learning for climate research',
      year: 2025,
      source_index: 'OpenAlex',
    },
    {
      id: 'crossref-2',
      doi: 'doi:10.1000/abc/xyz',
      title: 'Robust graph learning for climate research',
      year: 2025,
      source_index: 'Crossref',
    },
  ];

  const ranked = rankPaperRecords(records, 'robust graph learning', profile);
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

test('filters known Crossref non-paper records but keeps articles and preprints', () => {
  const records = [
    {
      id: 'article',
      title: 'CRISPR gene editing for inherited disease',
      type: 'journal-article',
      year: 2025,
      source_index: 'Crossref',
    },
    {
      id: 'preprint',
      title: 'CRISPR gene editing methods',
      type: 'posted-content',
      year: 2025,
      source_index: 'Crossref',
    },
    {
      id: 'reference-entry',
      title: 'CRISPR gene editing',
      type: 'reference-entry',
      year: 2025,
      source_index: 'Crossref',
    },
    {
      id: 'dataset',
      title: 'CRISPR gene editing benchmark data',
      type: 'dataset',
      year: 2025,
      source_index: 'Crossref',
    },
    {
      id: 'database',
      title: 'CRISPR gene editing entries',
      type: 'database',
      year: 2025,
      source_index: 'Crossref',
    },
  ];

  const ranked = rankPaperRecords(records, 'CRISPR gene editing', profile);
  assert.deepEqual(new Set(ranked.map(record => record.id)), new Set(['article', 'preprint']));
});

test('excludes future-dated and invalid publication records', () => {
  const currentYear = new Date().getFullYear();
  const makePaper = (id, year) => ({
    id, year, title: 'Clinical federated learning privacy',
    summary: 'Federated learning privacy techniques in clinical research.',
    source_index: 'OpenAlex', relevance_score: 0.9,
  });
  const ranked = rankPaperRecords([
    makePaper('valid', currentYear),
    makePaper('future', currentYear + 3),
    makePaper('invalid', 'not-a-year'),
  ], 'federated learning privacy', profile);
  assert.deepEqual(ranked.map(paper => paper.id), ['valid']);
});

test('enforces the selected two-year and five-year discovery windows', () => {
  const currentYear = new Date().getFullYear();
  const makePaper = (id, age) => ({
    id, year: currentYear - age, title: `Climate adaptation policy ${id}`,
    summary: 'Climate adaptation policy for vulnerable communities.',
    source_index: 'OpenAlex', relevance_score: 0.9,
  });
  const papers = [makePaper('recent', 1), makePaper('middle', 4), makePaper('old', 8)];
  assert.deepEqual(
    rankPaperRecords(papers, 'climate adaptation policy', { ...profile, recency: 'latest' }).map(paper => paper.id),
    ['recent'],
  );
  const fiveYears = rankPaperRecords(papers, 'climate adaptation policy', { ...profile, recency: 'five_years' });
  assert.deepEqual(new Set(fiveYears.map(paper => paper.id)), new Set(['recent', 'middle']));
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

test('uses Greek query terms and ignores accent differences when ranking papers', () => {
  const records = [
    {
      id: 'greek-paper',
      title: 'Ανιχνευση καρκινου με τεχνητη νοημοσυνη',
      summary: 'Αξιολόγηση μεθόδων τεχνητής νοημοσύνης για έγκαιρη ανίχνευση καρκίνου.',
      year: 2025,
      source_index: 'OpenAlex',
    },
    {
      id: 'unrelated-paper',
      title: 'Climate adaptation for coastal cities',
      summary: 'Planning flood resilience and climate adaptation for coastlines.',
      year: 2025,
      source_index: 'Crossref',
    },
  ];

  const ranked = rankPaperRecords(records, 'ανίχνευση καρκίνου τεχνητή νοημοσύνη', profile);
  assert.deepEqual(ranked.map(record => record.id), ['greek-paper']);
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
