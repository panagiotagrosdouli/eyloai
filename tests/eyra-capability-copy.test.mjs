import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('service-status UI distinguishes configured EYRA from a tested live model', () => {
  const source = readFileSync(new URL('../src/components/system/ServiceStatus.jsx', import.meta.url), 'utf8');
  assert.match(source, /EYRA configured/);
  assert.match(source, /actual AI calls and research sources are verified separately/);
  assert.doesNotMatch(source, /EYRA live/);
  assert.doesNotMatch(source, /ready: 'Live'/);
});
