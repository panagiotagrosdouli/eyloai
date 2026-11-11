import test from 'node:test';
import assert from 'node:assert/strict';
import { auditReviewMethods } from '../src/lib/literature-review-methods-audit.mjs';

test('reports documentation status without implying PRISMA certification', () => {
  const result = auditReviewMethods({
    question: 'What evidence exists?',
    search_databases: 'Crossref and Europe PMC',
    search_strings: 'topic AND treatment',
    search_date: '2026-11-11',
    inclusion_criteria: 'Human studies',
    exclusion_criteria: 'Animal-only studies',
    methods_notes: 'We did not search grey literature',
    screening: [{ paper_id: 'paper-1', decision: 'include' }],
  }, { libraryRowsShown: 1 });
  assert.equal(result.recorded, 6);
  assert.equal(result.screenedDecisions, 1);
  assert.equal(result.warnings.length, 0);
  assert.match(result.note, /does not establish/);
});

test('warns of incomplete database coverage and undocumented exclusion reasons', () => {
  const result = auditReviewMethods({
    question: 'Research question',
    screening: [{ paper_id: 'a', decision: 'exclude', reason: '   ' }],
  }, { libraryRowsShown: 100, listLimit: 100 });
  assert.equal(result.recorded, 1);
  assert.ok(result.warnings.some(message => /loading limit/.test(message)));
  assert.ok(result.warnings.some(message => /missing a researcher-authored reason/.test(message)));
});

test('empty or undecided screening is not treated as completed decisions', () => {
  const result = auditReviewMethods({ screening: [{ decision: 'undecided' }] });
  assert.equal(result.screenedDecisions, 0);
  assert.ok(result.warnings.some(message => /No include or exclude/.test(message)));
});
