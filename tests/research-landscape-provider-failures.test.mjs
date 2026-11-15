import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResearchBattlefield.jsx', import.meta.url), 'utf8');

test('landscape distinguishes provider errors from genuine empty research results', () => {
  assert.match(source, /searchOpenAlexAuthors\(searchQuery, 10, \{ throwOnError: true \}\)/);
  assert.match(source, /searchOpenAlexInstitutions\(searchQuery, 6, \{ throwOnError: true \}\)/);
  assert.match(source, /searchOpenAlexWorks\(searchQuery, 8, 'relevance', \{ throwOnError: true \}\)/);
  assert.match(source, /Empty counts are not proof of no research/);
});
