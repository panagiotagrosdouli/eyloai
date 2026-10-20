import test from 'node:test';
import assert from 'node:assert/strict';
import { toBibTeX, toRIS } from '../src/utils/citation-export.js';

test('BibTeX exports available metadata without inventing fields', () => {
  const result = toBibTeX([{ title: 'Safe Navigation', authors: 'Ada Lovelace and Grace Hopper', year: 2026, doi: 'https://doi.org/10.1234/example', url: 'https://example.org/paper' }]);
  assert.match(result, /@misc\{lovelace20261,/);
  assert.match(result, /author = \{Ada Lovelace and Grace Hopper\}/);
  assert.match(result, /doi = \{10\.1234\/example\}/);
});
test('RIS exports authors separately and terminates each record', () => {
  const result = toRIS([{title:'Paper',authors:'Ada Lovelace and Grace Hopper',year:2025}]);
  assert.match(result, /AU  - Ada Lovelace\r\nAU  - Grace Hopper/);
  assert.match(result, /ER  - $/);
  assert.doesNotMatch(result, /DO  - /);
});
test('empty results export no invented references', () => {
  assert.equal(toBibTeX([]), '');
  assert.equal(toRIS([]), '');
});
