import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchGapCoverage } from '../src/lib/research-gap-coverage.mjs';
import { saveDiscoveredGapPaper } from '../src/lib/research-gap-literature-save.mjs';

test('retrieval coverage preserves available and unavailable source status', () => {
  const coverage = buildResearchGapCoverage({
    papers: [{ id: '1' }, { id: '2' }],
    source_status: [
      { id: 'openalex', label: 'OpenAlex', status: 'available', count: 7 },
      { id: 'arxiv', label: 'arXiv', status: 'unavailable', count: 3 },
    ],
  });
  assert.equal(coverage.record_count, 2);
  assert.equal(coverage.available_source_count, 1);
  assert.equal(coverage.unavailable_source_count, 1);
  assert.deepEqual(coverage.sources.map((source) => [source.label, source.status, source.count]), [
    ['OpenAlex', 'available', 7],
    ['arXiv', 'unavailable', 0],
  ]);
});

test('live source records are saved with source metadata and selected project association', async () => {
  let created;
  const entities = {
    SavedPaper: {
      filter: async () => [],
      create: async (record) => { created = { id: 'saved-1', ...record }; return created; },
    },
  };
  const saved = await saveDiscoveredGapPaper({
    entities,
    paper: { id: 'W1', title: 'Evidence study', authors: 'A. Author', source_index: 'OpenAlex', url: 'https://openalex.org/W1' },
    project: { id: 'project-1', title: 'Study project' },
  });
  assert.equal(saved.source_id, 'W1');
  assert.equal(saved.project_id, 'project-1');
  assert.equal(created.source_index, 'OpenAlex');
});

test('an existing project link is not reassigned when saving live literature', async () => {
  const existing = { id: 'saved-1', source_id: 'W1', project_id: 'project-other' };
  const entities = {
    SavedPaper: {
      filter: async () => [existing],
      update: async () => assert.fail('Must not reassign an existing project link'),
      create: async () => assert.fail('Must not duplicate an existing source'),
    },
  };
  await assert.rejects(
    saveDiscoveredGapPaper({ entities, paper: { id: 'W1', title: 'Evidence study' }, project: { id: 'project-1' } }),
    /existing association was preserved/,
  );
});
