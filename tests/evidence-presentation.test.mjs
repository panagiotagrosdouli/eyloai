import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evidenceCoverageFromCount,
  EVIDENCE_COVERAGE_LABELS,
  fundingRelevanceWeight,
} from '../src/lib/evidence-presentation.js';

test('paper count describes retrieval coverage, not scientific support', () => {
  assert.equal(evidenceCoverageFromCount(2), 'LIMITED');
  assert.equal(evidenceCoverageFromCount(3), 'MODERATE');
  assert.equal(evidenceCoverageFromCount(8), 'BROAD');
  assert.match(EVIDENCE_COVERAGE_LABELS.BROAD, /coverage/i);
  assert.doesNotMatch(EVIDENCE_COVERAGE_LABELS.BROAD, /support|confidence|certainty/i);
});

test('funding relevance uses ordinal bands instead of fake numeric precision', () => {
  assert.ok(fundingRelevanceWeight('strong') > fundingRelevanceWeight('moderate'));
  assert.ok(fundingRelevanceWeight('moderate') > fundingRelevanceWeight('possible'));
  assert.equal(fundingRelevanceWeight('unranked'), 0);
});
