import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phdSourceLinks, phdSearchKeywords } from '../src/lib/phd-search-links.mjs';

const careers = readFileSync(new URL('../src/pages/Careers.jsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('PhD entry provides a source search without a failed EURAXESS proxy', () => {
  assert.deepEqual(phdSourceLinks('PhD'), {
    keywords: '',
    findaphd: 'https://www.findaphd.com/phds/',
    euraxess: 'https://euraxess.ec.europa.eu/jobs/search',
  });
  assert.equal(phdSourceLinks('PhD climate resilience').findaphd,
    'https://www.findaphd.com/phds/?Keywords=climate%20resilience');
  assert.equal(phdSourceLinks('doctoral machine learning').keywords, 'machine learning');
});

test('PhD source URLs remain fixed to known hosts with encoded, bounded search text', () => {
  const userQuery = 'PhD \"climate & AI\" ?x=https://evil.example/#';
  const found = phdSourceLinks(userQuery);
  const url = new URL(found.findaphd);
  assert.equal(url.origin, 'https://www.findaphd.com');
  assert.equal(url.pathname, '/phds/');
  assert.equal(url.searchParams.get('Keywords'), phdSearchKeywords(userQuery));
  assert.equal(new URL(found.euraxess).hostname, 'euraxess.ec.europa.eu');
  assert.ok(phdSearchKeywords('PhD ' + 'x'.repeat(500)).length <= 180);
});

test('PhD source-first links are visible even while API and job feeds are loading', () => {
  assert.match(routes, /path="\/find-phd"/);
  assert.match(careers, /showPhdSources && \(/);
  assert.match(careers, /href=\{phdLinks\.findaphd\}/);
  assert.match(careers, /href=\{phdLinks\.euraxess\}/);
  assert.match(careers, /Results open on the provider website/);
  const sourceBlock = careers.indexOf('{showPhdSources && (');
  const loadingBlock = careers.indexOf('{loading && <div role="status"');
  assert.ok(sourceBlock >= 0 && sourceBlock < loadingBlock, 'source navigation should render before result loading states');
});
