import test from 'node:test';
import assert from 'node:assert/strict';
import { savePaperSummary } from '../src/lib/paper-summary-persistence.js';

const paper = { id: 'W123', title: 'Evidence in science', authors: 'A. Researcher', year: 2025, url: 'https://example.org/paper' };

test('paper summary save updates the existing library record', async () => {
  const calls = [];
  const entities = { SavedPaper: {
    filter: async (...args) => { calls.push(['filter', ...args]); return [{ id: 'saved-1', source_id: 'W123' }]; },
    update: async (...args) => { calls.push(['update', ...args]); return { id: 'saved-1' }; },
    create: async (...args) => { calls.push(['create', ...args]); },
  } };

  const result = await savePaperSummary({ entities, paper, sourceText: 'Abstract', summary: { findings: 'Finding' } });

  assert.equal(result.id, 'saved-1');
  assert.equal(calls.filter(([kind]) => kind === 'update').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'create').length, 0);
});

test('paper summary save creates a record when lookup succeeds with no match', async () => {
  const calls = [];
  const entities = { SavedPaper: {
    filter: async () => [],
    update: async () => { throw new Error('unexpected update'); },
    create: async (record) => { calls.push(record); return record; },
  } };

  const result = await savePaperSummary({ entities, paper, sourceText: 'Abstract', summary: { findings: 'Finding' } });

  assert.equal(result.source_id, 'W123');
  assert.equal(result.summary, 'Abstract');
  assert.deepEqual(result.eyra_summary, { findings: 'Finding' });
  assert.equal(calls.length, 1);
});

test('paper summary save does not create a duplicate when lookup fails', async () => {
  let creates = 0;
  const lookupError = new Error('library unavailable');
  const entities = { SavedPaper: {
    filter: async () => { throw lookupError; },
    update: async () => {},
    create: async () => { creates += 1; },
  } };

  await assert.rejects(
    savePaperSummary({ entities, paper, sourceText: 'Abstract', summary: { findings: 'Finding' } }),
    lookupError,
  );
  assert.equal(creates, 0);
});
