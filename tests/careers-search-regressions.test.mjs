import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCareerListings, combineCareerSearchResults } from '../src/lib/careers-api.js';

test('doctoral role abbreviations and punctuation match without admitting unrelated disciplines', () => {
  const items = [
    { title: 'Doctoral candidate in climate science' },
    { title: 'Ph.D. student in climate science' },
    { title: 'Post-doctoral fellow in climate science' },
    { title: 'Doctoral candidate in biology' },
  ];
  assert.deepEqual(filterCareerListings(items, 'PhD climate research'), items.slice(0, 2));
  assert.deepEqual(filterCareerListings(items, 'postdoc climate'), [items[2]]);
});

test('career results deduplicate the same source URL across providers and pages', () => {
  const job = { id: 'a', title: 'Research assistant', source_url: 'https://euraxess.ec.europa.eu/jobs/123' };
  assert.equal(combineCareerSearchResults([job], [{ ...job, id: 'b' }], 'research assistant').length, 1);
});

test('a malformed 200 response is a source failure, never a legitimate empty search', async () => {
  const { searchCareers, loadGeneralCareerListings } = await import('../src/lib/careers-api.js');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ message: 'maintenance' }) });
  try {
    await assert.rejects(searchCareers('biology'), /invalid response/);
    await assert.rejects(loadGeneralCareerListings(), /unavailable/);
  } finally { globalThis.fetch = previousFetch; }
});
