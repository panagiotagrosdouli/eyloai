import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/Library.jsx', import.meta.url), 'utf8');

test('authenticated Library exports filtered saved papers, not unrequested unfiltered records', () => {
  assert.match(source, /const filteredPapers = filter\(papers, \['title', 'authors', 'source'\]\)/);
  assert.match(source, /toBibTeX\(filteredPapers\)/);
  assert.match(source, /toRIS\(filteredPapers\)/);
  assert.match(source, /Export BibTeX/);
  assert.match(source, /Export RIS/);
  assert.match(source, /eylo-saved-papers\.bib/);
  assert.match(source, /eylo-saved-papers\.ris/);
});

test('citation export is disabled on failed collection loads and warns metadata is unverified', () => {
  assert.match(source, /failedCollections\.includes\('papers'\)/);
  assert.match(source, /if \(loading \|\| failedCollections\.includes\('papers'\) \|\| !filteredPapers\.length\) return/);
  assert.match(source, /Metadata are not automatically Crossref-verified/);
});
