import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('project ID changes invalidate earlier in-flight reads', () => {
  assert.match(source, /const loadGenerationRef = useRef\(0\)/);
  assert.match(source, /const generation = \+\+loadGenerationRef\.current/);
  assert.match(source, /loadGenerationRef\.current !== generation\) return/);
  assert.match(source, /return \(\) => \{ loadGenerationRef\.current \+= 1; \}/);
});

test('previous project records are removed before fetching a different project', () => {
  const begin = source.indexOf('const loadAll = async () => {');
  const reads = source.indexOf('await Promise.allSettled([', begin);
  assert.ok(begin >= 0 && reads > begin);
  const prefix = source.slice(begin, reads);
  for (const expression of [
    'setProject(null)', 'setSavedPapers([])', 'setSavedResearchers([])',
    'setSavedOpportunities([])', 'setMeetings([])', 'setEditing({})',
  ]) assert.ok(prefix.includes(expression), 'Missing clear: ' + expression);
});

test('a stale wrong-ID response is rejected and never displayed as a different project', () => {
  assert.match(source, /projectResult\.value\.id !== id/);
  assert.match(source, /loading \|\| \(project && project\.id !== id\)/);
});
