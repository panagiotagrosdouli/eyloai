import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EYRA_MODES, EYRA_QUICK_COMMANDS } from '../src/lib/eyra-next-policy.mjs';

test('research lens and quick-action UI consume one canonical policy registry', () => {
  const controls = readFileSync(new URL('../src/components/eyra/EyraResearchControls.jsx', import.meta.url), 'utf8');
  const chat = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  assert.equal(EYRA_MODES.length, 13);
  for (const id of ['general', 'literature', 'methodology', 'writing', 'data', 'project', 'critical']) {
    assert.match(controls, new RegExp(`\\b${id}:`), `Missing navigation for ${id}`);
  }
  assert.equal(EYRA_QUICK_COMMANDS.length, 6);
  assert.match(controls, /EYRA_MODES\.map/);
  assert.match(controls, /EYRA_QUICK_COMMANDS\.find\(command => command\.id === id\)/);
  assert.match(controls, /EYRA_MODE_STARTER_IDS\[activeMode\]/);
  assert.match(controls, /suggestions\.map/);
  assert.match(controls, /aria-pressed=\{active\}/);
  assert.match(controls, /role="group" aria-label="EYRA research lens"/);
  assert.match(controls, /disabled=\{disabled\}/);
  assert.match(chat, /<EyraModeSelector activeMode=\{activeMode\} onChange=\{setActiveMode\}/);
  assert.match(chat, /<EyraQuickCommands activeMode=\{activeMode\} onSelect=\{prompt => void sendMessage\(prompt\)\}/);
  assert.doesNotMatch(chat, /QUICK_COMMANDS\.map/);
});
