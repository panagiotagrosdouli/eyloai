import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('project detail requests only its own linked evidence from the database', () => {
  for (const kind of ['SavedPaper', 'SavedResearcher', 'SavedOpportunity']) {
    assert.match(source, new RegExp(`base44\\.entities\\.${kind}\\.filter\\(\\{ project_id: id \\}, '-created_date', 100\\)`),
      `${kind} must use a database-side project filter`);
  }
});

test('project detail does not query arbitrary library top-100 records', () => {
  for (const kind of ['SavedPaper', 'SavedResearcher', 'SavedOpportunity']) {
    assert.doesNotMatch(source, new RegExp(`base44\\.entities\\.${kind}\\.list\\('-created_date', 100\\)`));
  }
});
