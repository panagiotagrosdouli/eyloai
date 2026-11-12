import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildResearchGapCoverage } from '../src/lib/research-gap-coverage.mjs';
import { researchPaperIdentity, saveDiscoveredGapPaper } from '../src/lib/research-gap-literature-save.mjs';

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

test('DOI identity is normalized across provider IDs and duplicate records are reused', async () => {
  assert.deepEqual(researchPaperIdentity({ id: 'openalex:W1', doi: 'https://doi.org/10.1234/ABC.1' }), {
    doi: '10.1234/abc.1', sourceId: 'doi:10.1234/abc.1',
  });
  const existing = { id: 'saved-1', source_id: 'doi:10.1234/abc.1', doi: '10.1234/abc.1', title: 'Evidence study' };
  let created = 0;
  const saved = await saveDiscoveredGapPaper({
    entities: { SavedPaper: {
      filter: async () => [existing],
      create: async () => { created += 1; throw new Error('must not create duplicate'); },
    } },
    paper: { id: 'crossref:W999', DOI: 'doi:10.1234/ABC.1', title: 'Evidence study' },
  });
  assert.equal(saved.id, 'saved-1');
  assert.equal(created, 0);
});

test('unsafe source URLs are not persisted as clickable scholarly links', async () => {
  let created;
  await saveDiscoveredGapPaper({
    entities: { SavedPaper: {
      filter: async () => [],
      create: async (record) => { created = record; return record; },
    } },
    paper: { id: 'W1', title: 'Evidence study', url: 'javascript:alert(1)' },
  });
  assert.equal(created.url, '');
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

test('Research Gap Finder uses live search and exposes retrieval limits', () => {
  const page = readFileSync(new URL('../src/pages/ResearchGaps.jsx', import.meta.url), 'utf8');
  assert.match(page, /searchAllPapersWithStatus\(query/);
  assert.match(page, /buildResearchGapCoverage\(result\)/);
  assert.match(page, /not a systematic review/);
  assert.match(page, /Save records to your Library before using them in an analysis/);
});
