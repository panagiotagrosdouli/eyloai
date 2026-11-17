import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('research composer delegates side effects to Command Center', () => {
  const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  const composer = readFileSync(new URL('../src/components/eyra/EyraComposer.jsx', import.meta.url), 'utf8');
  assert.match(ui, /<EyraComposer/);
  assert.match(ui, /inputRef=\{inputRef\} value=\{input\} onChange=\{setInput\}/);
  assert.match(ui, /onStop=\{stopGeneration\}/);
  assert.match(ui, /onStartListening=\{startListening\} onStopListening=\{stopListening\}/);
  assert.match(composer, /maxLength=\{allowWorkspaceActions \? 1000 : 2000\}/);
  assert.match(composer, /disabled=\{!value\.trim\(\) \|\| loading\}/);
  assert.match(composer, /aria-label="Stop EYRA generation"/);
  assert.match(composer, /aria-label="Message EYRA"/);
  assert.match(composer, /aria-label=\{listening \? 'Stop voice input' : 'Start voice input'\}/);
});
