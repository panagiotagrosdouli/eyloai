import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/Projects.jsx', import.meta.url), 'utf8');

test('project load errors are tracked separately from project creation errors', () => {
  assert.match(source, /const \[loadError, setLoadError\] = useState\(''\)/);
  assert.match(source, /catch \(failure\) \{\s*setLoadError\(/);
  assert.match(source, /catch \(createError\) \{\s*setError\(/);
});

test('project empty state does not misrepresent a failed creation as a failed list', () => {
  assert.match(source, /loadError && projects\.length === 0/);
  assert.doesNotMatch(source, /\) : error && projects\.length === 0/);
  assert.match(source, /loadError && <button type="button" onClick=\{loadProjects\}/);
});
