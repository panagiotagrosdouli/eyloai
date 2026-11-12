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

test('internal Library record IDs are never invented as public reference URLs', () => {
  const source = { id: 'secret-internal-uuid', title: 'Stored paper', authors: 'Jane Doe', year: 2025 };
  assert.doesNotMatch(toBibTeX([source]), /secret-internal-uuid|url = /);
  assert.doesNotMatch(toRIS([source]), /secret-internal-uuid|UR  - /);
});

test('unsafe URLs and invalid DOIs are omitted from reference-manager exports', () => {
  const source = { title: 'Test study', doi: 'not a doi', url: 'javascript:alert(1)' };
  assert.doesNotMatch(toBibTeX([source]), /url = |doi = |javascript:/);
  assert.doesNotMatch(toRIS([source]), /UR  - |DO  - |javascript:/);
});

test('valid HTTPS DOI and publication URL remain usable in bibliography exports', () => {
  const source = { title: 'Evidence study', doi: 'https://doi.org/10.1000/xyz', url: 'https://publisher.example/record' };
  assert.match(toBibTeX([source]), /doi = \{10\.1000\/xyz\}/);
  assert.match(toBibTeX([source]), /url = \{https:\/\/publisher\.example\/record\}/);
  assert.match(toRIS([source]), /DO  - 10\.1000\/xyz/);
});
