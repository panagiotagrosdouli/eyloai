import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('EYRA studio centers the starting state without obscuring subsequent conversation', () => {
  const ui = read('components/eyra/EyraCommandCenter.jsx');
  assert.match(ui, /messages\.length === 1 \? 'justify-center' : ''/);
  assert.match(ui, /aria-label="EYRA conversation"/);
  assert.match(ui, /Where should we begin\?/);
  assert.match(ui, /sm:w-\[min\(1060px,calc\(100vw-2rem\)\)\]/);
  assert.match(ui, /h-\[100dvh\]/);
  assert.match(ui, /safe-area-inset-bottom/);
  assert.match(ui, /<EyraQuickCommands activeMode=\{activeMode\}/);
});

test('lens modes are accessible and starters adapt to the selected research task', () => {
  const modes = read('components/eyra/EyraResearchControls.jsx');
  assert.match(modes, /aria-label="EYRA research lens"/);
  assert.match(modes, /aria-pressed=\{active\}/);
  assert.match(modes, /suggestions\.map\(command =>/);
  assert.match(modes, /sm:grid-cols-3/);
  assert.match(modes, /onSelect\(command\.prompt\)/);
  assert.match(modes, /disabled=\{disabled\}/);
});

test('secondary history and explicit write approval remain in the EYRA dialog', () => {
  const ui = read('components/eyra/EyraCommandCenter.jsx');
  assert.match(ui, /History &amp; tools/);
  assert.match(ui, /onClick=\{exportConversation\}/);
  assert.match(ui, /<EyraAgentRunHistory/);
  assert.match(ui, /<EyraWriteIntentReview/);
  assert.match(ui, /checked=\{allowWorkspaceActions\}/);
  assert.match(ui, /disabled=\{!cloudHistoryReady \|\| loading \|\| savingConversation \|\| historyBusy\}/);
  assert.match(ui, /role="status" aria-label="Cloud conversation history"/);
  assert.match(ui, /checkEyraCitationIds\(baseAnswer, evidence\.sources\)/);
});

test('chat composer and cited sources preserve accessible research actions', () => {
  const composer = read('components/eyra/EyraComposer.jsx');
  const timeline = read('components/eyra/EyraConversationTimeline.jsx');
  for (const name of ['Message EYRA', 'Send message', 'Start voice input', 'Stop voice input', 'Stop EYRA generation']) {
    assert.ok(composer.includes(name), name);
  }
  assert.match(composer, /maxLength=\{allowWorkspaceActions \? 1000 : 2000\}/);
  assert.match(composer, /disabled=\{!value\.trim\(\) \|\| loading\}/);
  assert.match(timeline, /describeEyraCitedEvidence\(msg\.sources\)/);
  assert.match(timeline, /not independently verified/);
  assert.match(timeline, /focus-visible:outline/);
});
