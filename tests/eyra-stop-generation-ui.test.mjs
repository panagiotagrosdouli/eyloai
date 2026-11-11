import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('EYRA user can stop an active request from keyboard-accessible interface', () => {
  assert.match(source, /aria-label="Stop EYRA generation"/);
  assert.match(source, /activeRequestRef\.current\.abort\(\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
});

test('late retrieval or model output cannot create an answer after user cancelled', () => {
  assert.match(source, /controller\.signal\.throwIfAborted\(\)/);
  assert.match(source, /if \(controller\.signal\.aborted\) return;/);
  assert.match(source, /if \(activeRequestRef\.current === controller\)/);
  assert.match(source, /Generation stopped\. No new EYRA response was saved/);
});
