import test from 'node:test';
import assert from 'node:assert/strict';
import { getResearchEvidenceContextKey } from '../src/lib/research-gap-context.mjs';

test('evidence context is stable when selected paper order changes', () => {
  assert.equal(
    getResearchEvidenceContextKey('project-a', ['paper-1', 'paper-2']),
    getResearchEvidenceContextKey('project-a', ['paper-2', 'paper-1']),
  );
});

test('evidence context changes when the project or selected evidence changes', () => {
  const first = getResearchEvidenceContextKey('project-a', ['paper-1', 'paper-2']);
  assert.notEqual(getResearchEvidenceContextKey('project-b', ['paper-1', 'paper-2']), first);
  assert.notEqual(getResearchEvidenceContextKey('project-a', ['paper-1']), first);
});

test('evidence context excludes duplicate and missing paper IDs', () => {
  assert.equal(
    getResearchEvidenceContextKey('project-a', ['paper-1', 'paper-1', null, undefined]),
    getResearchEvidenceContextKey('project-a', ['paper-1']),
  );
});


test('Research Gap Finder cancels superseded model requests and keeps independent result contexts', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/pages/ResearchGaps.jsx', import.meta.url), 'utf8');
  assert.match(source, /activeAnalysisRef\.current\?\.abort\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /controller\.signal\.throwIfAborted\(\)/);
  assert.match(source, /if \(!controller\.signal\.aborted\) setError/);
  assert.match(source, /if \(activeAnalysisRef\.current === controller\)/);
  assert.match(source, /hasCurrentComparison && comparison/);
  assert.match(source, /hasCurrentGaps && gaps\.map/);
  assert.doesNotMatch(source, /hasCurrentAnalysis/);
});
