import test from 'node:test';
import assert from 'node:assert/strict';

import { buildResearchUrl, isCommandShortcut } from '../src/lib/command-shortcuts.js';

test('recognizes Cmd/Ctrl+K without hijacking Alt combinations', () => {
  assert.equal(isCommandShortcut({ key: 'k', metaKey: true, ctrlKey: false, altKey: false }), true);
  assert.equal(isCommandShortcut({ key: 'K', metaKey: false, ctrlKey: true, altKey: false }), true);
  assert.equal(isCommandShortcut({ key: 'k', metaKey: true, ctrlKey: false, altKey: true }), false);
  assert.equal(isCommandShortcut({ key: 'j', metaKey: true, ctrlKey: false, altKey: false }), false);
});

test('builds a shareable research URL without leaking raw query syntax', () => {
  assert.equal(buildResearchUrl('  carbon capture & storage  '), '/home?q=carbon%20capture%20%26%20storage');
  assert.equal(buildResearchUrl(''), '/home');
});
