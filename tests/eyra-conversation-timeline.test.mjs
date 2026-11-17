import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('EYRA accessible timeline keeps evidence warnings and explicit source links', () => {
  const timeline = readFileSync(new URL('../src/components/eyra/EyraConversationTimeline.jsx', import.meta.url), 'utf8');
  const command = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  assert.match(command, /import \{ TypingIndicator, Message \} from '@\/components\/eyra\/EyraConversationTimeline'/);
  assert.match(timeline, /describeEyraCitedEvidence\(msg\.sources\)/);
  assert.match(timeline, /Retrieved records are not independently verified/);
  assert.match(timeline, /aria-label="EYRA retrieved source records"/);
  assert.match(timeline, /rel="noopener noreferrer"/);
  assert.match(timeline, /role="status" aria-live="polite"/);
});
