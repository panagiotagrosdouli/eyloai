import test from 'node:test';
import assert from 'node:assert/strict';

import { searchCrossref } from '../src/lib/eyra-api.js';

test('Crossref client requests and preserves record type for local development', async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      message: {
        items: [{ DOI: '10.1000/example', title: ['A CRISPR gene editing study'], type: 'journal-article' }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const papers = await searchCrossref('CRISPR gene editing', 5);
  const params = new URL(requestedUrl).searchParams;

  assert.equal(params.get('select').split(',').includes('type'), true);
  assert.equal(papers[0].type, 'journal-article');
});
