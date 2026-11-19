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


test('EYRA distinguishes metadata from full-text evidence and avoids unsupported scientific claims', () => {
  for (const requirement of [
    'directly supported by retrieved text',
    'unverified hypothesis',
    'none establishes that you have read the full paper',
    'sources disagree',
    'actual supplied citation ID',
    'citation identifier validation',
    'never invent sample sizes',
  ]) {
    assert.ok(EYRA_INSTRUCTIONS.includes(requirement), `Missing scientific safeguard: ${requirement}`);
  }
});
