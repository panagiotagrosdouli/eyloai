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

test('live retrieval can target the deployed proxy without falling back to direct providers', async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async url => {
    requestedUrls.push(String(url));
    return new Response('rate limited', { status: 429 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    searchCrossref('climate adaptation for coastal cities', 5, 'relevance', {
      proxyBaseUrl: 'https://eyloai.vercel.app',
      throwOnError: true,
    }),
    /Crossref request failed: 429/,
  );

  assert.equal(requestedUrls.length, 1);
  const requestUrl = new URL(requestedUrls[0]);
  assert.equal(requestUrl.origin, 'https://eyloai.vercel.app');
  assert.equal(requestUrl.pathname, '/api/discovery');
  assert.equal(requestUrl.searchParams.get('provider'), 'crossref');
  assert.equal(requestUrl.searchParams.get('q'), 'climate adaptation for coastal cities');
});
