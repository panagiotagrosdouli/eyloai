import test from 'node:test';
import assert from 'node:assert/strict';
import opportunitiesHandler from '../api/opportunities.js';
import { applyFundingRanking } from '../src/lib/funding-ranking.mjs';
import {
  filterFundingOpportunities,
  formatFundingComparisonValue,
  getFundingComparisonRecords,
  isSafeFundingSourceUrl,
} from '../src/lib/funding-comparison.mjs';

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('provider-shaped Grants.gov and EU records survive ranking and compare without fabricated facts', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.VITE_SUPABASE_URL;
  const oldKey = process.env.VITE_SUPABASE_ANON_KEY;
  process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'sb_publishable_disposable_test';
  t.after(() => {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = oldKey;
  });

  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.endsWith('/auth/v1/user')) return { ok: true };
    if (target === 'https://api.grants.gov/v1/api/search2') {
      return { ok: true, json: async () => ({ errorcode: 0, data: { oppHits: [{
        id: 12000, number: 'NSF-TEST-1', title: 'NSF climate research grant',
        closeDate: '2099-12-31', openDate: '2026-01-01', oppStatus: 'posted', agencyName: 'National Science Foundation',
      }] } }) };
    }
    if (target === 'https://api.grants.gov/v1/api/fetchOpportunity') {
      return { ok: true, json: async () => ({ data: { synopsis: {
        synopsisDesc: 'Official source description.',
        applicantTypes: [{ description: 'Universities' }],
        fundingInstruments: [{ description: 'Grant' }],
        awardFloorFormatted: '100,000', awardCeilingFormatted: '500,000',
        fundingActivityCategories: [{ description: 'Climate research' }],
      } } }) };
    }
    if (target.includes('api.tech.ec.europa.eu/search-api/prod/rest/search')) {
      return { ok: true, json: async () => ({ results: [{
        summary: 'Official EU portal summary.',
        metadata: {
          identifier: ['HORIZON-CLIMATE-2026'],
          title: ['Horizon climate adaptation call'],
          status: ['31094501'],
          deadlineDate: ['2099-11-30'],
          eligibleApplicants: ['Research organisations'],
          budget: [{ currency: 'EUR', amount: 2000000 }],
          country: ['Greece', 'Portugal'],
          keywords: ['["Climate adaptation","Resilience"]'],
        },
      }] }) };
    }
    throw new Error(`Unexpected upstream request: ${target}`);
  };

  const res = response();
  await opportunitiesHandler({
    method: 'GET',
    headers: { authorization: 'Bearer fixture-session' },
    query: { q: 'climate adaptation', limit: '12' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 2);
  const ranked = applyFundingRanking(res.body.items, {
    ranked: [
      { id: 'eu:HORIZON-CLIMATE-2026', match_score: 82, match_reason: 'Relevant to climate adaptation.', difficulty: 'Medium', title: 'Invented title' },
      { id: 'unknown', match_score: 100, title: 'Injected call' },
    ],
  });
  const eu = ranked.find((item) => item.id === 'eu:HORIZON-CLIMATE-2026');
  const us = ranked.find((item) => item.source === 'Grants.gov');
  assert.equal(eu.title, 'Horizon climate adaptation call');
  assert.equal(eu.amount, 'currency: EUR; amount: 2000000');
  assert.deepEqual(eu.categories, ['Climate adaptation; Resilience']);
  assert.equal(us.title, 'NSF climate research grant');
  assert.equal(us.eligibility, 'Universities');
  assert.equal(us.match_score, null);
  assert.equal(us.difficulty, 'Unranked');
  assert.equal(ranked.length, 2, 'model output must not add opportunities');

  const climate = filterFundingOpportunities(ranked, { field: 'resilience' });
  const compare = getFundingComparisonRecords(climate, [eu.id, us.id]);
  assert.deepEqual(compare.map((item) => item.id), [eu.id]);
  assert.equal(isSafeFundingSourceUrl(eu.source_url), true);
  assert.equal(isSafeFundingSourceUrl(us.source_url), true);
  assert.equal(formatFundingComparisonValue(eu.categories), 'Climate adaptation; Resilience');
  assert.equal(formatFundingComparisonValue(undefined), 'Not provided by source');
});
