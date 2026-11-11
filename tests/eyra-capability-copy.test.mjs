import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('status UI does not treat service secrets as a verified live AI invocation', () => {
  const source = readFileSync(new URL('../src/components/system/ServiceStatus.jsx', import.meta.url), 'utf8');
  assert.match(source, /EYRA configured/);
  assert.match(source, /actual AI calls and research sources are verified separately/);
  assert.doesNotMatch(source, /EYRA live/);
  assert.doesNotMatch(source, /ready: 'Live'/);
});
