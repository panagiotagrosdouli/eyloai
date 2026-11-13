import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('Command Center creates stable IDs once per user message and saves independently of generation', () => {
  assert.match(source, /conversationIdRef\.current \|\| crypto\.randomUUID\(\)/);
  assert.match(source, /makePendingEyraUserMessage\(content, conversationId\)/);
  assert.match(source, /conversationTitleRef\.current \|\| userMsg\.conversationTitle/);
  assert.match(source, /void persistUserMessage\(userMsg\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
});

test('Command Center confirms saved status only after the server write resolves', () => {
  const start = source.indexOf('const persistUserMessage = async (message) =>');
  const end = source.indexOf('const sendMessage = async (text) =>', start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /await saveEyraUserMessage\(message,/);
  assert.match(body, /persistence: 'saved'/);
  assert.ok(body.indexOf("persistence: 'saved'") > body.indexOf('await saveEyraUserMessage('));
  assert.match(body, /persistence: eyraPersistenceStatus\(error\)/);
  assert.match(body, /persistenceRequestsRef\.current\.has\(message\.id\)/);
  assert.match(body, /persistenceRequestsRef\.current\.delete\(message\.id\)/);
});

test('visible statuses, retry action and local-only copy remain available', () => {
  for (const status of ['saving', 'saved', 'failed', 'unconfirmed', 'local-only']) {
    assert.match(source, new RegExp(status));
  }
  assert.match(source, /data-eyra-persistence=/);
  assert.match(source, /aria-label="Retry saving EYRA message"/);
  assert.match(source, /onRetryPersistence=\{persistUserMessage\}/);
  assert.match(source, /sessionStorage\.setItem\('eyra_command_conversation_v2'/);
  assert.match(source, /sessionStorage\.getItem\('eyra_command_conversation_v2'/);
  assert.match(source, /Only messages marked Saved to EYRA are confirmed on the server/);
});

test('legacy local history, cancellation and other EYLO product flows are preserved', () => {
  assert.match(source, /return Array\.isArray\(parsed\) && parsed\.length/);
  assert.match(source, /message\.persistence === 'saving'/);
  assert.match(source, /\{ \.\.\.message, persistence: 'unconfirmed' \}/);
  assert.match(source, /messages\.slice\(-30\)/);
  assert.match(source, /activeRequestRef\.current\.abort\(\)/);
  assert.match(source, /if \(controller\.signal\.aborted\) return/);
  assert.match(source, /base44\.entities\.Idea\.create/);
  assert.match(source, /enable_project_tools: true/);
  assert.match(source, /onClick=\{clearConversation\}/);
});
