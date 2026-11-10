import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/opportunities.js';

test('funding API merges verified EU calls with Grants.gov records', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return { ok: true };
    if (target === 'https://api.grants.gov/v1/api/search2') return { ok: true, json: async () => ({ errorcode: 0, data: { hitCount: 0, oppHits: [] } }) };
    if (target.includes('api.tech.ec.europa.eu/search-api/prod/rest/search')) return {
      ok: true,
      json: async () => ({ results: [{ content: {
        identifier: 'HORIZON-TEST-2026', title: 'Verified research call', programmeName: 'Horizon Europe',
        status: 'Open', deadlineDate: '2099-12-31', eligibility: 'Research organisations', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-TEST-2026',
      } }] }),
    };
    throw new Error(`Unexpected upstream request: ${target}`);
  };
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await handler({ method: 'GET', headers: { authorization: 'Bearer test' }, query: { q: 'research' } }, response);
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.source.includes('EU Funding & Tenders Portal'));
    assert.equal(response.body.items[0].title, 'Verified research call');
    assert.equal(response.body.items[0].agency, 'Horizon Europe');
    assert.equal(response.body.items[0].eligibility, 'Research organisations');
    assert.match(response.body.items[0].source_url, /^https:\/\/ec\.europa\.eu\//);
  } finally { globalThis.fetch = previousFetch; }
});
