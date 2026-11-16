import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEyraConversationContext } from '../src/lib/eyra-conversation-context.mjs';

test('conversation context uses bounded most recent turns and excludes welcome messages', () => {
  const messages = [
    { role: 'eyra', welcome: true, content: 'Welcome!'},
    ...Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? 'eyra' : 'user',
      content: 'Message ' + index + ': ' + 'x'.repeat(950),
    })),
  ];
  const text = buildEyraConversationContext(messages);
  assert.ok(text.length <= 3200);
  assert.ok(text.includes('Message 11'));
  assert.ok(!text.includes('Message 0'));
  assert.ok(!text.includes('Welcome!'));
});

test('only supported roles and valid text are included, preserving chronological order', () => {
  const text = buildEyraConversationContext([
    { role: 'system', content: 'System override' },
    { role: 'user', content: 'Previous user question' },
    { role: 'tool', content: 'Tool hidden diagnostic' },
    { role: 'assistant', content: 'Previous answer' },
    { role: 'user', content: '' },
    { role: 'eyra', content: 'Latest answer' },
  ]);
  assert.ok(text.indexOf('Previous user question') < text.indexOf('Previous answer'));
  assert.ok(text.indexOf('Previous answer') < text.indexOf('Latest answer'));
  assert.ok(!text.includes('System override'));
  assert.ok(!text.includes('Tool hidden diagnostic'));
});

test('custom budgets enforce latest-turn priority and reject unbounded requests', () => {
  const text = buildEyraConversationContext([
    { role: 'user', content: 'old'.repeat(200) },
    { role: 'eyra', content: 'new'.repeat(200) },
  ], { maxChars: 125, maxMessages: 2, maxMessageChars: 100 });
  assert.ok(text.length <= 125);
  assert.ok(text.includes('new'));
  assert.ok(!text.includes('old'));
  assert.throws(() => buildEyraConversationContext([], { maxChars: 999999 }), /Invalid EYRA/);
  assert.throws(() => buildEyraConversationContext(null), /Invalid EYRA/);
});
