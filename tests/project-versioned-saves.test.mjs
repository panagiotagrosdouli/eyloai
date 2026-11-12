import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const project = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('core human-authored project fields use versioned saves', () => {
  assert.match(project, /Project\.updateIfUnchanged\(id, localDraft, base\.updated_date\)/);
  assert.match(project, /Project\.updateIfUnchanged\(id, \{ tasks \}, project\.updated_date\)/);
  assert.match(project, /Project\.updateIfUnchanged\(id, \{ evidence_matrix \}, project\.updated_date\)/);
});

test('EYRA report cannot overwrite a project edited during an external model call', () => {
  const captured = project.indexOf('const analysisProjectVersion = project.updated_date;');
  const request = project.indexOf('const [papersResult, researchersResult, fundingResult]');
  const write = project.indexOf('Project.updateIfUnchanged(\n        id, { eyra_analysis: result }, analysisProjectVersion');
  assert.ok(captured > 0 && request > captured && write > request);
  assert.match(project, /setProject\(savedAnalysis\)/);
});

test('project failures remain visible and do not silently retry over a conflict', () => {
  assert.match(project, /Could not save project/);
  assert.match(project, /Could not update task/);
  assert.match(project, /Could not save evidence matrix/);
  assert.doesNotMatch(project, /Project\.update\(id,/);
});
