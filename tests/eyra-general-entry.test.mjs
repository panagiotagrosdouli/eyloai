import test from 'node:test';
import assert from 'node:assert/strict';
import { getEyraMode, EYRA_MODES, EYRA_QUICK_COMMANDS } from '../src/lib/eyra-next-policy.mjs';
import { shouldRetrieve } from '../src/lib/eyra-retrieval-plan.mjs';
import { buildEyraCommandPrompt } from '../src/lib/eyra-command-evidence.mjs';

test('EYRA offers general assistance without forcing research retrieval', () => {
  assert.equal(getEyraMode('general').label, 'Everyday');
  assert.equal(EYRA_MODES[0].id, 'general');
  assert.deepEqual(shouldRetrieve('Help me write a birthday message', 'general'),
    { funding: false, people: false, papers: false });
  assert.deepEqual(shouldRetrieve('Find papers on climate adaptation', 'general'),
    { funding: false, people: false, papers: true });
});

test('general starter actions offer explanation, writing and planning', () => {
  for (const id of ['explain', 'write', 'plan']) {
    const command = EYRA_QUICK_COMMANDS.find(item => item.id === id);
    assert.ok(command, id + ' starter must exist');
    assert.ok(command.prompt.length > 20);
  }
});

test('general assistant prompt can be formed with no retrieved evidence', () => {
  const prompt = buildEyraCommandPrompt({
    baseSystem: 'Help the user.',
    modePrompt: getEyraMode('general').prompt,
    language: 'English',
    style: 'Keep it concise',
    workspaceContext: '',
    query: 'Help me draft an email',
    evidenceBlocks: [],
    history: '',
    userRequest: 'Help me draft an email',
  });
  assert.match(prompt, /Help me draft an email/);
  assert.match(prompt, /do not manufacture citations/i);
});
