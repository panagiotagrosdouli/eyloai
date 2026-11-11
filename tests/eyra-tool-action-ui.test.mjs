import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('the authenticated command center opts into only the bounded project and library action path', () => {
  assert.match(source, /enable_project_tools: true/);
  assert.match(source, /tool_intent: content/);
  assert.match(source, /signal: controller\.signal/);
});

test('persisted action IDs survive invalid source-citation model prose', () => {
  assert.match(source, /if \(!citations\.valid\) throw Object\.assign\(/);
  assert.match(source, /actions: response\?\.actions \|\| \[\]/);
  assert.match(source, /formatEyraToolActions\(error\?\.actions\)/);
});

test('action status is tied to server-confirmed outcomes, not model predictions', () => {
  assert.match(source, /action\.status === 'succeeded' && action\.tool === 'project\.create'/);
  assert.match(source, /action\.status === 'succeeded' && action\.tool === 'library\.save_paper'/);
  assert.match(source, /response\?\.actions/);
});
