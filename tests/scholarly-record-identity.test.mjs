import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeScholarlyRecords, scholarlyDoi } from '../src/lib/scholarly-record-identity.mjs';
import { rankPaperRecords } from '../src/lib/eyra-api.js';

test('only actual DOI identifiers become DOI keys; suffixes remain opaque', () => {
  assert.equal(scholarlyDoi('https://doi.org/10.1234/ABC%2Ftest.v2'), '10.1234/abc/test.v2');
  assert.equal(scholarlyDoi('https://arxiv.org/abs/1234.5678'), '');
  assert.equal(scholarlyDoi('not-a-doi'), '');
});
test('same-DOI duplicates retain both index records and fill only a missing same-title abstract', () => {
  const input = [
    { title: 'Climate coastal adaptation', doi: '10.1234/source', url: 'https://openalex.org/W1', source_index: 'OpenAlex', summary: '  ' },
    { title: 'Climate coastal adaptation', doi: 'https://doi.org/10.1234/SOURCE', url: 'https://doi.org/10.1234/source', source_index: 'Crossref', summary: 'Climate coastal adaptation methods from supplied metadata.' },
  ];
  const [paper] = mergeScholarlyRecords(input);
  assert.deepEqual(paper.indexed_by, ['OpenAlex', 'Crossref']);
  assert.equal(paper.summary_source, 'Crossref');
  assert.equal(paper.source_index, 'OpenAlex', 'primary source and benchmark source-count semantics remain unchanged');
  assert.equal(paper.source_records.length, 2);
  assert.equal(paper.summary, input[1].summary);
  assert.equal(input[0].summary, '  ', 'provider inputs are immutable');
  assert.equal(rankPaperRecords(input, 'climate coastal adaptation').length, 1);
});
test('conflicting DOI titles are disclosed and cannot donate an abstract to another title', () => {
  const records = mergeScholarlyRecords([
    { doi: '10.1234/same', title: 'Climate coastal adaptation', source_index: 'OpenAlex' },
    { doi: '10.1234/same', title: 'Unrelated cardiac study', summary: 'Unrelated findings', source_index: 'Crossref' },
  ]);
  assert.equal(records[0].metadata_conflict, true);
  assert.equal(records[0].summary, undefined);
});
test('title fallback keeps full titles and author/year distinctions, never invents DOI identity from source URLs', () => {
  const prefix = 'Research methods '.repeat(9);
  const rows = mergeScholarlyRecords([
    { title: `${prefix}coastal flooding`, url: 'https://example.org/one', year: 2025, authors: 'A' },
    { title: `${prefix}cancer screening`, url: 'https://example.org/two', year: 2025, authors: 'A' },
    { title: 'Review', year: 2024, authors: 'A' },
    { title: 'Review', year: 2025, authors: 'B' },
  ]);
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => !row._dedupeKey.startsWith('doi:')));
});
