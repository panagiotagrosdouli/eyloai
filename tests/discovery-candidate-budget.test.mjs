import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAllPapersWithStatus } from '../src/lib/eyra-api.js';
test('candidate overfetch is bounded, retains the exact query and never fabricates replacements for empty providers', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async resource => {
    const url = new URL(String(resource)); calls.push(url);
    if (url.searchParams.get('provider') === 'arxiv') return new Response('<feed xmlns="http://www.w3.org/2005/Atom"></feed>');
    return Response.json({ results: [], resultList: { result: [] }, message: { items: [] }, data: [] });
  };
  try {
    for (const requested of [1, 1000]) {
      calls.length = 0;
      const result = await searchAllPapersWithStatus('coastal adaptation methods', { limit: requested, proxyBaseUrl: 'http://127.0.0.1:12345' });
      assert.equal(calls.length, 5, 'overfetch adds candidates, not more provider requests');
      assert.equal(result.papers.length, 0);
      for (const url of calls) {
        assert.equal(url.origin, 'http://127.0.0.1:12345');
        assert.equal(url.searchParams.get('q'), 'coastal adaptation methods');
        const limit = Number(url.searchParams.get('limit'));
        assert.ok(limit >= 1 && limit <= 30);
        if (url.searchParams.get('provider') === 'arxiv') assert.ok(limit <= 12);
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});
