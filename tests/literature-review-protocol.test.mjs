import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyReviewProtocol,
  validateReviewProtocol,
  screeningCounts,
  reviewProtocolSnapshot,
  isSafeLiteratureSourceUrl,
  hasUnsavedReviewChanges,
  reviewProtocolDraftKey,
  screeningLogCsv,
} from '../src/lib/literature-review-protocol.mjs';

const full = {
  ...emptyReviewProtocol(),
  question: 'Do interventions alter a prespecified patient-reported outcome?',
  search_strings: '("intervention") AND ("outcome")',
  search_databases: 'Europe PMC, Crossref',
  inclusion_criteria: 'Human intervention studies with reported outcomes',
  exclusion_criteria: 'Non-intervention reports',
  search_date: '2026-11-11',
  screening: [
    { paper_id: 'paper-a', decision: 'include', reason: 'Meets predefined criteria' },
    { paper_id: 'paper-b', decision: 'exclude', reason: 'Not an intervention study' },
  ],
};

test('review protocol normalizes and accepts a reproducible, human-reviewed screening log', () => {
  const result = validateReviewProtocol(full, ['paper-a', 'paper-b']);
  assert.equal(result.ok, true);
  assert.equal(result.protocol.version, 1);
  assert.deepEqual(screeningCounts(result.protocol), {
    considered: 2, included: 1, excluded: 1, undecided: 0,
  });
});

test('protocol cannot be saved without a question, search, inclusion and exclusion criteria', () => {
  const result = validateReviewProtocol(emptyReviewProtocol(), []);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(message => /research question/i.test(message)));
  assert.ok(result.errors.some(message => /search string/i.test(message)));
  assert.ok(result.errors.some(message => /inclusion and exclusion/i.test(message)));
});

test('cross-account or unsaved paper identifiers are rejected instead of persisted', () => {
  const result = validateReviewProtocol({
    ...full,
    screening: [{ paper_id: 'another-account-paper', decision: 'include', reason: '' }],
  }, ['paper-a', 'paper-b']);
  assert.equal(result.ok, false);
  assert.equal(result.protocol.screening.length, 0);
});

test('duplicate decisions and exclusion without human explanation fail validation', () => {
  const result = validateReviewProtocol({
    ...full,
    screening: [
      { paper_id: 'paper-a', decision: 'exclude', reason: '' },
      { paper_id: 'paper-a', decision: 'include', reason: '' },
    ],
  }, ['paper-a']);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(message => /reason/.test(message)));
  assert.ok(result.errors.some(message => /duplicate/.test(message)));
});

test('invalid calendar dates and oversized screening sets are rejected', () => {
  const invalid = validateReviewProtocol({ ...full, search_date: '2026-02-30' }, ['paper-a', 'paper-b']);
  assert.equal(invalid.ok, false);
  const oversizedIds = Array.from({ length: 101 }, (_, i) => 'paper-' + i);
  const oversized = validateReviewProtocol({
    ...full,
    screening: oversizedIds.map(paper_id => ({ paper_id, decision: 'undecided' })),
  }, oversizedIds);
  assert.equal(oversized.ok, false);
  assert.ok(oversized.errors.some(message => /maximum of 100/.test(message)));
});

test('JSON export includes only authorized saved-paper snapshots, not invented source metadata', () => {
  const snapshot = reviewProtocolSnapshot(
    { id: 'project-a', title: 'Cancer Review' },
    { ...full, screening: [...full.screening, { paper_id: 'not-in-library', decision: 'include' }] },
    [
      { id: 'paper-a', title: 'A real saved paper', doi: '10.1234/test', url: 'https://doi.org/10.1234/test', year: 2024 },
      { id: 'paper-b', title: 'Another saved paper', doi: '', url: 'https://openalex.org/W123', year: 2025 },
    ],
    '2026-11-11T08:00:00.000Z',
  );
  assert.equal(snapshot.protocol.screening.length, 2);
  assert.equal(snapshot.counts.included, 1);
  assert.equal(snapshot.counts.excluded, 1);
  assert.match(snapshot.reporting_note, /Not a PRISMA-compliant/);
  assert.equal(JSON.stringify(snapshot).includes('not-in-library'), false);
});

test('external source links reject executable schemes, embedded credentials and relative URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'file:///root/key',
    'https://user:pass@publisher.example/article', '../relative', '//publisher.example/article']) {
    assert.equal(isSafeLiteratureSourceUrl(url), false, url);
  }
  assert.equal(isSafeLiteratureSourceUrl('https://doi.org/10.1234/example'), true);
});

test('dirty-state check preserves incomplete user edits and ignores server save timestamps', () => {
  const saved = { ...emptyReviewProtocol(), question: 'Initial question', updated_at: '2026-11-11T00:00:00Z' };
  const edited = { ...saved, question: 'Updated, currently incomplete question' };
  assert.equal(hasUnsavedReviewChanges(edited, saved), true);
  assert.equal(hasUnsavedReviewChanges({ ...saved, updated_at: '2099-01-01T00:00:00Z' }, saved), false);
  assert.equal(hasUnsavedReviewChanges(saved, saved), false);
});

test('screening reorder does not imply unsaved changes; changed decisions do', () => {
  const a = { ...full, screening: [...full.screening] };
  const reordered = { ...full, screening: [...full.screening].reverse() };
  assert.equal(reviewProtocolDraftKey(a), reviewProtocolDraftKey(reordered));
  assert.equal(hasUnsavedReviewChanges(a, reordered), false);
  assert.equal(hasUnsavedReviewChanges(a, {
    ...full,
    screening: full.screening.map(item => item.paper_id === 'paper-b' ? { ...item, reason: 'Different reason' } : item),
  }), true);
});

test('CSV screening log exports only verified snapshot rows with Excel-safe formula escaping', () => {
  const snapshot = reviewProtocolSnapshot(
    { id: 'owned-project', title: 'Evidence review' },
    { ...full, screening: [{ paper_id: 'paper-a', decision: 'exclude', reason: '=HYPERLINK("https://evil.example")' }] },
    [{ id: 'paper-a', title: '+SUM(1,1)', doi: '10.1234/real', url: 'https://doi.org/10.1234/real', year: 2026 }],
    '2026-11-11T10:00:00Z',
  );
  const csv = screeningLogCsv(snapshot);
  assert.match(csv, /^paper_id,title,doi,url,year,decision,reason\r\n/);
  assert.ok(csv.includes(String.raw`"'+SUM(1,1)"`));
  assert.ok(csv.includes(String.raw`"'=HYPERLINK(""https://evil.example"")"`));
  assert.equal(csv.split('\r\n').length, 3);
  assert.equal(csv.includes('not-in-library'), false);
});

test('CSV also neutralizes leading whitespace or tab before spreadsheet formulas', () => {
  const csv = screeningLogCsv({ protocol: { screening: [{
    paper_id: 'paper-a', title: '\t=1+1', doi: '10.1234/test', url: '', year: 2026,
    decision: 'include', reason: '  +1+1',
  }] } });
  assert.ok(csv.includes(`"'\t=1+1"`));
  assert.ok(csv.includes(`"'  +1+1"`));
});
