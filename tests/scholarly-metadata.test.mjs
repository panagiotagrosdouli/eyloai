import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDoi,
  reconcileScholarlyRecords,
} from '../src/lib/scholarly-metadata.js';

test('canonicalizes DOI URL, doi prefix and case without inventing identifiers', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1000/ABC.Def'), '10.1000/abc.def');
  assert.equal(normalizeDoi('doi:10.1000/ABC.Def'), '10.1000/abc.def');
  assert.equal(normalizeDoi('not-a-doi'), '');
  assert.equal(normalizeDoi(''), '');
});

test('does not strip DOI suffixes that merely look like version numbers', () => {
  assert.equal(normalizeDoi('10.1000/example.v2'), '10.1000/example.v2');
  assert.notEqual(normalizeDoi('10.1000/example.v2'), normalizeDoi('10.1000/example'));
});

test('links repository concept DOI and version DOI only when both records and titles agree', () => {
  const records = reconcileScholarlyRecords([
    {
      id: 'concept',
      doi: '10.32920/25613349',
      title: 'Pedestrian Trajectory Prediction',
      authors: 'A. Author',
      source_index: 'Repository',
    },
    {
      id: 'version',
      doi: '10.32920/25613349.v1',
      title: 'Pedestrian Trajectory Prediction',
      authors: 'A. Author',
      source_index: 'Repository',
    },
  ]);

  assert.equal(records.length, 1);
  assert.equal(records[0].doi, '10.32920/25613349');
  assert.deepEqual(records[0].version_dois, ['10.32920/25613349.v1']);
});

test('reconciles the same DOI across providers and retains provenance', () => {
  const [paper] = reconcileScholarlyRecords([
    {
      id: 'oa-1',
      doi: 'https://doi.org/10.5555/example',
      title: 'Reliable Metadata for Research',
      authors: 'A. Researcher',
      year: 2025,
      source: 'Journal A',
      source_index: 'OpenAlex',
      type: 'article',
    },
    {
      id: 'cr-1',
      doi: '10.5555/EXAMPLE',
      title: 'Reliable Metadata for Research',
      authors: 'Alex Researcher',
      year: 2025,
      source: 'Journal A',
      source_index: 'Crossref',
      type: 'journal-article',
    },
  ]);

  assert.equal(paper.doi, '10.5555/example');
  assert.equal(paper.doi_status, 'cross_source_match');
  assert.deepEqual(paper.record_sources, ['Crossref', 'OpenAlex']);
  assert.equal(paper.metadata_provenance.length, 2);
  assert.equal(paper.year_conflict, false);
});

test('retains publication-year disagreement instead of guessing it away', () => {
  const [paper] = reconcileScholarlyRecords([
    {
      id: 'one',
      doi: '10.5555/date-conflict',
      title: 'Online First Versus Issue Publication',
      authors: 'A. Author',
      year: 2023,
      publication_date: '2023-12-18',
      source_index: 'OpenAlex',
      type: 'article',
    },
    {
      id: 'two',
      doi: '10.5555/date-conflict',
      title: 'Online First Versus Issue Publication',
      authors: 'A. Author',
      year: 2024,
      publication_date: '2024-01-10',
      source_index: 'Crossref',
      type: 'journal-article',
    },
  ]);

  assert.equal(paper.year_conflict, true);
  assert.deepEqual(paper.year_candidates, [2023, 2024]);
  assert.match(paper.metadata_note, /differs across sources/i);
});

test('does not label an arXiv record as peer reviewed', () => {
  const [paper] = reconcileScholarlyRecords([
    {
      id: 'https://arxiv.org/abs/2601.12345v2',
      title: 'A Preprint About Something Important',
      authors: 'A. Author',
      year: 2026,
      publication_date: '2026-01-20',
      source: 'arXiv',
      source_index: 'arXiv',
      type: 'preprint',
    },
  ]);

  assert.equal(paper.publication_status, 'preprint');
  assert.equal(paper.arxiv_id, '2601.12345');
});

test('deduplicates punctuation variants without DOI when title and lead author match', () => {
  const records = reconcileScholarlyRecords([
    {
      id: 'one',
      title: 'Trustworthy AI: A Practical Review',
      authors: 'Jane Smith, Alex Doe',
      year: 2025,
      source_index: 'Provider A',
    },
    {
      id: 'two',
      title: 'Trustworthy AI — A Practical Review',
      authors: 'J. Smith; A. Doe',
      year: 2025,
      source_index: 'Provider B',
    },
  ]);

  assert.equal(records.length, 1);
  assert.equal(records[0].doi, '');
  assert.equal(records[0].doi_status, 'missing');
});
