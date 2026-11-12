import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDecisionDraft, normalizeDecision, normalizeDecisionList, validateDecision,
} from '../src/lib/decision-workspace.mjs';

function validDecision(overrides = {}) {
  return {
    ...createDecisionDraft('decision-1'),
    title: 'Choose a sampling plan',
    question: 'Which sampling plan best fits the study constraints?',
    status: 'planning',
    alternatives: [{ id: 'a', text: 'Stratified sample' }],
    criteria: [{ id: 'c', text: 'Coverage' }],
    evidence: [{ id: 'e', claim: 'The population has distinct subgroups.', source_label: 'Study protocol', source_url: 'https://example.org/protocol' }],
    ...overrides,
  };
}

test('decision validation requires a real question, supported state and valid evidence sources', () => {
  assert.equal(validateDecision(validDecision()).valid, true);
  assert.match(validateDecision(validDecision({ question: '' })).errors.join(' '), /question/i);
  assert.match(validateDecision(validDecision({ status: 'approved' })).errors.join(' '), /status/i);
  assert.match(validateDecision(validDecision({ evidence: [{ id: 'e', claim: 'Claim', source_label: 'Source', source_url: 'javascript:alert(1)' }] })).errors.join(' '), /HTTP or HTTPS/i);
});

test('decision validation rejects overlong and oversized lists instead of silently truncating saves', () => {
  assert.match(validateDecision(validDecision({ title: 'x'.repeat(161) })).errors.join(' '), /title/i);
  assert.match(validateDecision(validDecision({ review_date: '2026-02-31' })).errors.join(' '), /real calendar date/i);
  assert.match(validateDecision(validDecision({ alternatives: Array.from({ length: 13 }, (_, i) => ({ id: String(i), text: 'Option' })) })).errors.join(' '), /12 or fewer/i);
  assert.match(validateDecision(validDecision({ rationale: 'x'.repeat(6001) })).errors.join(' '), /6000 characters/i);
  assert.match(validateDecision(validDecision({ decision: 'x'.repeat(3001) })).errors.join(' '), /Recorded choice/i);
});

test('normalization keeps only supported fields, bounded rows, and valid source links are retained', () => {
  const normalized = normalizeDecision({
    ...validDecision(),
    unexpected: 'discarded',
    alternatives: [...validDecision().alternatives, { id: 'empty', text: '   ' }],
    evidence: [{ id: 'e', claim: 'Claim', source_label: 'Paper', source_url: 'https://example.org/paper' }],
  });
  assert.equal(normalized.unexpected, undefined);
  assert.equal(normalized.alternatives.length, 1);
  assert.equal(normalized.evidence[0].source_url, 'https://example.org/paper');
  assert.deepEqual(normalizeDecisionList(null), []);
  assert.equal(normalizeDecisionList([null, [], validDecision()]).length, 1);
  assert.equal(normalizeDecisionList(Array.from({ length: 105 }, (_, index) => validDecision({ id: String(index) }))).length, 105);
});
