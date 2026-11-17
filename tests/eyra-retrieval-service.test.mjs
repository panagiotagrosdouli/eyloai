import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveEyraEvidence } from '../src/lib/eyra-retrieval-service.mjs';

test('partial scientific source outage preserves verified record groups and failure count', async () => {
  const calls = [];
  const result = await retrieveEyraEvidence('Find university researcher and literature evidence', 'research', '', undefined, {
    searchPapers: async query => { calls.push('papers'); return { papers: [{ id: 'P1' }], source_status: ['openalex'] }; },
    searchAuthors: async () => { calls.push('researchers'); throw new Error('provider outage'); },
    searchInstitutions: async () => { calls.push('institutions'); return [{ id: 'I1' }]; },
    searchFunding: async () => { calls.push('funding'); return { items: [] }; },
    buildEvidence: (groups, failedCount) => ({ groups, failedCount, blocks: ['verified'], sources: [{ id: 'P1' }] }),
  });
  assert.equal(result.attempted, true);
  assert.deepEqual(result.groups.papers.items, [{ id: 'P1' }]);
  assert.deepEqual(result.groups.institutions.items, [{ id: 'I1' }]);
  assert.equal(result.failedCount, 1);
  assert.equal(calls.includes('funding'), false);
});

test('no retrieval intent preserves quiet conversation without provider access', async () => {
  const result = await retrieveEyraEvidence('hello there', 'startup', '', undefined, {});
  assert.equal(result.attempted, false);
  assert.deepEqual(result.sources, []);
});

test('cancelled retrieval does not return incomplete evidence as verified', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    retrieveEyraEvidence('paper', 'research', '', controller.signal, {}),
    e => e.name === 'AbortError',
  );
});
