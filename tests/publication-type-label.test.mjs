import test from 'node:test';
import assert from 'node:assert/strict';

import { publicationTypeLabel } from '../src/lib/publication-type-label.js';

test('labels common scholarly record types without claiming peer review', () => {
  assert.equal(publicationTypeLabel('preprint'), 'Preprint');
  assert.equal(publicationTypeLabel('posted-content'), 'Posted content');
  assert.equal(publicationTypeLabel('journal-article'), 'Journal article record');
  assert.equal(publicationTypeLabel('JournalArticle'), 'Journal article record');
  assert.equal(publicationTypeLabel('proceedings-article'), 'Conference paper record');
});

test('does not infer a record type when provider metadata is missing or unknown', () => {
  assert.equal(publicationTypeLabel(''), 'Record type not reported');
  assert.equal(publicationTypeLabel(undefined), 'Record type not reported');
  assert.equal(publicationTypeLabel('unrecognized-provider-type'), 'Record type not reported');
});
