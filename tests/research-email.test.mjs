import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidEmailAddress, parseResearchEmailDraft } from '../src/lib/research-email.mjs';

test('researcher email validation accepts common institutional addresses', () => {
  assert.equal(isValidEmailAddress('researcher@university.edu'), true);
  assert.equal(isValidEmailAddress('a.smith+lab@research-university.ac.uk'), true);
  assert.equal(isValidEmailAddress('  professor@uni.example  '), true);
});

test('researcher email validation rejects incomplete and whitespace-containing addresses', () => {
  assert.equal(isValidEmailAddress('not an email'), false);
  assert.equal(isValidEmailAddress('name@university'), false);
  assert.equal(isValidEmailAddress('name @university.edu'), false);
  assert.equal(isValidEmailAddress('x'.repeat(246) + '@uni.edu'), false);
});

test('research email drafts preserve real line breaks for mailto bodies', () => {
  const parsed = parseResearchEmailDraft('Subject: Research question\n\nDear Professor,\nI am interested in your work.');
  assert.equal(parsed.subject, 'Research question');
  assert.equal(parsed.body, 'Dear Professor,\nI am interested in your work.');
});

test('research email drafts without a subject remain intact', () => {
  const draft = 'Dear Professor,\nI would like to discuss my research.';
  assert.deepEqual(parseResearchEmailDraft(draft), {
    subject: 'Research inquiry',
    body: draft,
  });
});
