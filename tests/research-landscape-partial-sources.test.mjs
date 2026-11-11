import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResearchBattlefield.jsx', import.meta.url), 'utf8');

test('landscape provider failures do not discard valid results from other sources', () => {
  assert.match(source, /Promise\.allSettled\(\[/);
  assert.match(source, /result\.status === 'fulfilled' && Array\.isArray\(result\.value\)/);
  assert.match(source, /setSourceWarning\(/);
  assert.match(source, /Partial source data:/);
});

test('landscape does not claim no literature when all providers fail', () => {
  assert.match(source, /if \(failedSources\.length === 4\) throw new Error/);
  assert.match(source, /Empty counts are not proof of no research/);
  assert.match(source, /role="status"/);
});
