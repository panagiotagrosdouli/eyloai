import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/projects/EvidenceMatrixStudio.jsx', import.meta.url), 'utf8');

test('matrix controls have associated labels, visible result status, and safe source links', () => {
  assert.match(source, /htmlFor="evidence-research-question"/);
  assert.match(source, /id="evidence-research-question"/);
  assert.match(source, /role=\{error \? 'alert' : 'status'\}/);
  assert.match(source, /aria-label="Scholarly provider status"/);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /isSafeLiteratureSourceUrl\(paper\.url\)/);
});

test('mobile layout and keyboard-operable native controls remain available', () => {
  assert.match(source, /sm:flex-row/);
  assert.match(source, /md:grid-cols-2/);
  assert.match(source, /<button type="button"/);
  assert.match(source, /<input type="checkbox"/);
  assert.match(source, /<textarea/);
});
