import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/IdeaVault.jsx', import.meta.url), 'utf8');

test('Idea Vault bounds loading and exposes a retry after provider failure', () => {
  assert.match(source, /IDEAS_LOAD_TIMEOUT_MS\s*=\s*12_000/);
  assert.match(source, /promiseWithTimeout\([\s\S]*?Idea\.list\('-created_date'\)[\s\S]*?IDEAS_LOAD_TIMEOUT_MS/);
  assert.match(source, /\.catch\(error => \{[\s\S]*?setLoadError\(/);
  assert.match(source, /\.finally\(\(\) => \{ if \(active\) setLoading\(false\); \}\)/);
  assert.match(source, /loadError \?\s*\([\s\S]*?onClick=\{loadIdeas\}/);
});

test('Idea Vault persists edits and confirms destructive deletes', () => {
  assert.match(source, /startEditing = \(idea\)/);
  assert.match(source, /base44\.entities\.Idea\.update\(editingId, payload\)/);
  assert.match(source, /aria-label=\{`Edit \$\{idea\.title/);
  assert.match(source, /window\.confirm\(`Delete/);
  assert.match(source, /base44\.entities\.Idea\.delete\(id\)/);
  assert.match(source, /title: 'Idea could not be deleted'/);
});

test('Idea Vault does not report failed saves as successful', () => {
  assert.match(source, /base44\.entities\.Idea\.create\(\{ \.\.\.payload, status: 'active' \}\)/);
  assert.match(source, /title: editingId \? 'Idea could not be updated' : 'Idea could not be saved'/);
  assert.match(source, /disabled=\{!form\.title\.trim\(\) \|\| saving\}/);
});
