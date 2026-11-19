import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EYRA_MODES, EYRA_QUICK_COMMANDS, EYRA_BASE_SYSTEM,
  EYRA_STYLE_INSTRUCTIONS, EYRA_LANGUAGE_NAMES, getEyraMode,
} from '../src/lib/eyra-next-policy.mjs';

test('EYRA Next modes and shortcuts have unique stable identifiers and explicit prompts', () => {
  for (const entries of [EYRA_MODES, EYRA_QUICK_COMMANDS]) {
    assert.equal(new Set(entries.map(item => item.id)).size, entries.length);
    assert.ok(entries.every(item => /^[a-z]+$/.test(item.id) && item.label && item.prompt.length > 30));
  }
  assert.equal(getEyraMode('research').id, 'research');
  assert.equal(getEyraMode('unknown').id, 'research');
  assert.equal(EYRA_MODES.length, 13);
  for (const id of ['general', 'literature', 'methodology', 'writing', 'data', 'project', 'critical']) {
    assert.equal(getEyraMode(id).id, id);
  }
});

test('every mode inherits one common scientific trust boundary', () => {
  for (const phrase of ['untrusted data', 'Never create a citation identifier', 'inference',
    'evidence is empty', 'academic questions', 'private workspace']) {
    assert.ok(EYRA_BASE_SYSTEM.includes(phrase), phrase);
  }
  assert.ok(EYRA_LANGUAGE_NAMES.el === 'Greek');
  assert.ok(EYRA_STYLE_INSTRUCTIONS.detailed.includes('limitations'));
});

test('Command Center uses shared policy rather than embedding a divergent system prompt', () => {
  const component = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  assert.match(component, /from '@\/lib\/eyra-next-policy\.mjs'/);
  assert.match(component, /const BASE_SYSTEM = EYRA_BASE_SYSTEM/);
  assert.doesNotMatch(component, /const BASE_SYSTEM = `/);
});
