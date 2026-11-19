import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const center = read('components/eyra/EyraCommandCenter.jsx');
const mode = read('components/eyra/EyraResearchControls.jsx');
const composer = read('components/eyra/EyraComposer.jsx');
const timeline = read('components/eyra/EyraConversationTimeline.jsx');

test('EYRA is a full-height mobile-safe conversation-first dialog', () => {
  assert.match(center, /role="dialog"/);
  assert.match(center, /aria-modal="true"/);
  assert.match(center, /h-\[100dvh\]/);
  assert.match(center, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(center, /max-w-3xl/);
  assert.match(center, /min\(960px,calc\(100vw-2rem\)\)/);
  assert.match(center, /safe-area-inset-bottom/);
});

test('outcomes are in the empty conversation rather than permanent navigation', () => {
  assert.match(center, /msg\.welcome \? \(messages\.length === 1/);
  assert.match(center, /<EyraQuickCommands onSelect=\{prompt => void sendMessage\(prompt\)\}/);
  assert.match(mode, /Start with a goal/);
  assert.match(mode, /EYRA_QUICK_COMMANDS\.map/);
  assert.match(mode, /aria-pressed=\{active\}/);
  assert.match(mode, /role="group" aria-label="EYRA research lens"/);
});

test('nonessential cloud history and sensitive tools are secondary and fail closed', () => {
  const details = center.indexOf('<details className="group');
  const warning = center.indexOf('role="status" aria-label="Cloud conversation history"');
  const controls = center.indexOf('Allow workspace tools for this request');
  assert.ok(details > 0 && warning > details && controls > warning);
  assert.match(center, /History &amp; tools/);
  assert.match(center, /disabled=\{!cloudHistoryReady \|\| loading \|\| savingConversation \|\| historyBusy\}/);
  assert.match(center, /cloudHistoryStatus === 'error' \|\| cloudHistoryStatus === 'unavailable'/);
  assert.match(center, /Re-check cloud history/);
  assert.match(center, /checked=\{allowWorkspaceActions\}/);
  assert.match(center, /setAllowWorkspaceActions\(event\.target\.checked\)/);
  assert.match(center, /onClick=\{exportConversation\}/);
  assert.match(center, /<EyraAgentRunHistory/);
  assert.match(center, /<EyraWriteIntentReview/);
});

test('messaging, voice, stop, export and safe scientific framing are retained', () => {
  for (const phrase of ['Message EYRA', 'Start voice input', 'Stop EYRA generation', 'Send message']) {
    assert.ok(composer.includes(phrase), phrase);
  }
  assert.match(composer, /maxLength=\{allowWorkspaceActions \? 1000 : 2000\}/);
  assert.match(composer, /disabled=\{!value\.trim\(\) \|\| loading\}/);
  assert.match(center, /checkEyraCitationIds\(baseAnswer, evidence\.sources\)/);
  assert.match(center, /buildEvidenceOnlyFallback\(evidence, error\)/);
  assert.match(center, /Review.*source|Check original sources/);
  assert.match(timeline, /describeEyraCitedEvidence\(msg\.sources\)/);
  assert.match(timeline, /not independently verified/);
  assert.match(timeline, /focus-visible:outline/);
});
