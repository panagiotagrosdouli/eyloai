import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResearcherSearchPlan } from '../src/lib/researcher-query-plan.mjs';

test('uses structured scientific searches without claiming researchers', () => {
  assert.deepEqual(normalizeResearcherSearchPlan({
    search_queries: ['rare disease machine learning', 'medical artificial intelligence', 'rare disease machine learning'],
    interpretation: 'Looking for publication-linked researchers in rare disease AI',
  }, 'I need a researcher using AI for rare diseases').searches, [
    'rare disease machine learning', 'medical artificial intelligence',
  ]);
});

test('falls back safely when EYRA gives malformed output', () => {
  const p = normalizeResearcherSearchPlan({ search_queries: [null, '', 'x'] }, 'natural language request');
  assert.deepEqual(p.searches, ['natural language request']);
  assert.equal(p.generated, false);
});

test('limits generated searches and explanation length', () => {
  const p = normalizeResearcherSearchPlan({search_queries: ['one', 'two', 'three', 'four'], interpretation:'x'.repeat(600)}, 'test');
  assert.equal(p.searches.length, 3);
  assert.equal(p.explanation.length, 350);
});
