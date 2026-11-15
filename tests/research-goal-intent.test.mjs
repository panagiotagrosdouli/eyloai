import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretResearchGoal } from '../src/lib/research-goal-intent.mjs';

test('explicit literature review request maps to a topical, review-mode source search', () => {
  assert.deepEqual(
    interpretResearchGoal('I want to prepare a literature review on AI in cancer diagnosis.'),
    { topic: 'AI in cancer diagnosis', goal: 'review' },
  );
  assert.deepEqual(
    interpretResearchGoal('Please conduct a systematic literature review about interpretable machine learning'),
    { topic: 'interpretable machine learning', goal: 'review' },
  );
});

test('research gap and understanding goals only map when the wording is explicit', () => {
  assert.deepEqual(interpretResearchGoal('Identify a research gap in pediatric oncology'), {
    topic: 'pediatric oncology', goal: 'thesis',
  });
  assert.deepEqual(interpretResearchGoal('I want to understand the research on clinical decision support'), {
    topic: 'clinical decision support', goal: 'understand',
  });
});

test('unknown, incomplete and malformed requests never fabricate intent', () => {
  for (const value of [
    'AI in cancer diagnosis',
    'Find funding for quantum imaging',
    'Prepare a literature review on',
    'I want to prepare a literature review on ?',
    '',
    null,
    123,
    'X'.repeat(2001),
  ]) assert.equal(interpretResearchGoal(value), null);
});

test('guided discovery uses the parsed goal without bypassing narrow-topic clarification', () => {
  const source = readFileSync(new URL('../src/components/discovery/GuidedSearch.jsx', import.meta.url), 'utf8');
  assert.match(source, /interpretResearchGoal\(value\)/);
  assert.match(source, /researchTopic\.split\(/);
  assert.match(source, /autoRefine \|\| needsScope/);
  assert.match(source, /goal: researchGoal/);
});
