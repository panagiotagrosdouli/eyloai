import test from 'node:test';
import assert from 'node:assert/strict';
import { searchOpenAlexWorks } from '../src/lib/eyra-api.js';

test('OpenAlex work results retain verified author IDs and PMC identifiers', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [{
    id: 'https://openalex.org/W123',
    doi: 'https://doi.org/10.0000/example',
    pmcid: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12345/',
    title: 'A source-indexed paper',
    authorships: [{ author: { id: 'https://openalex.org/A123', display_name: 'Casey Researcher' } }],
    open_access: { is_oa: true },
  }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const [paper] = await searchOpenAlexWorks('source indexed paper', 1);
  assert.deepEqual(paper.author_ids, ['https://openalex.org/A123']);
  assert.equal(paper.pmcid, 'PMC12345');
  assert.equal(paper.open_access, true);
});
