import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('project error recovery allows retry when a project cannot be loaded', () => {
  assert.match(page, /if \(!project\) \{[\s\S]*?loadError && <button type="button" onClick=\{loadAll\}/);
});

test('partial library-source outages provide a retry action', () => {
  assert.match(page, /Some linked research records could not be loaded/);
  assert.match(page, /\{loadError && <div role="status"[\s\S]*?onClick=\{loadAll\}/);
});
