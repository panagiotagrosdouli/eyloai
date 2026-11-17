import test from 'node:test';
import assert from 'node:assert/strict';
import { EYRA_INSTRUCTIONS } from '../server/eyra-system-instructions.mjs';

test('EYRA provider instructions preserve research integrity and tool write boundaries', () => {
  for (const phrase of [
    'Never invent papers', 'untrusted data', 'Distinguish verified evidence',
    'Only create projects', 'explicitly asks to save a paper',
    'bibliographic metadata', 'persistence', 
  ]) {
    // Persistence is represented by a verified saved record, not a generated claim.
    const found = phrase === 'persistence'
      ? EYRA_INSTRUCTIONS.includes('persisted record')
      : EYRA_INSTRUCTIONS.includes(phrase);
    assert.equal(found, true, phrase);
  }
  assert.ok(EYRA_INSTRUCTIONS.includes('Match the user\'s language.'));
});
