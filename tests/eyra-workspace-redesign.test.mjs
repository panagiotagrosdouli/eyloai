import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('EYRA keeps chat as primary surface with quick prompts inside scrolling conversation', () => {
  const command = read('components/eyra/EyraCommandCenter.jsx');
  const prompts = read('components/eyra/EyraResearchControls.jsx');
  const chat = command.indexOf('aria-label="EYRA conversation"');
  const quick = command.indexOf('<EyraQuickCommands onSelect=', chat);
  const composer = command.indexOf('<EyraComposer', quick);
  assert.ok(chat >= 0 && quick > chat && composer > quick);
  assert.match(command, /h-\[100dvh\]/);
  assert.match(command, /msg=\{msg\.welcome \? \{ \.\.\.msg, mode: activeMode \} : msg\}/);
  assert.match(command, /sm:w-\[min\(1000px,calc\(100vw-2\.5rem\)\)\]/);
  assert.match(prompts, /grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(prompts, /aria-pressed=\{active\}/);
  assert.match(prompts, /focus-visible:outline/);
});

test('advanced controls are collapsible but exports and audit runs remain available', () => {
  const ui = read('components/eyra/EyraCommandCenter.jsx');
  assert.match(ui, /<details[^>]+aria-label="Conversation and agent tools"/);
  assert.match(ui, /<summary[^>]+>/);
  for (const action of ['Save conversation snapshot', 'Export conversation', 'Open a saved conversation', 'Agent runs']) {
    assert.ok(ui.includes(action), action);
  }
  assert.match(ui, /disabled=\{!cloudHistoryReady \|\| loading \|\| savingConversation \|\| historyBusy\}/);
  assert.match(ui, /role="status" aria-label="Cloud conversation history"/);
  assert.match(ui, /onClick=\{exportConversation\}/);
  assert.match(ui, /<EyraWriteIntentReview/);
});

test('assistant output, source records and composer preserve accessibility', () => {
  const timeline = read('components/eyra/EyraConversationTimeline.jsx');
  const composer = read('components/eyra/EyraComposer.jsx');
  assert.match(timeline, /<ReactMarkdown>\{msg\.content\}<\/ReactMarkdown>/);
  assert.match(timeline, /describeEyraCitedEvidence\(msg\.sources\)/);
  assert.match(timeline, /Retrieved records are not independently verified/);
  assert.match(timeline, /focus-visible:outline/);
  assert.match(composer, /aria-label="Message EYRA"/);
  assert.match(composer, /aria-label="Send message"/);
  assert.match(composer, /onStopListening/);
});

test('authenticated home still offers real search, EYRA, and workspace destinations', () => {
  const home = read('components/dashboard/EyraHome.jsx');
  const layout = read('components/layout/AppLayout.jsx');
  assert.match(home, /Your research workspace/);
  assert.match(home, /onSearch\(homeQuery\.trim\(\)\)/);
  assert.match(home, /eylo:open-eyra/);
  for (const url of ['/search', '/library', '/projects?new=1', '/study-planner']) {
    assert.ok(home.includes(url), url);
  }
  assert.match(layout, /aria-label="Workspace navigation"/);
  assert.match(layout, /aria-label="Primary mobile navigation"/);
  assert.match(layout, /<EyraCommandCenter open=\{eyraOpen\}/);
});
