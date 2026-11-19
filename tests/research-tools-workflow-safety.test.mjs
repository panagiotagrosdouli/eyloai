import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchReport } from '../src/lib/research-report-export.mjs';
import { privateResearchCacheKey, readPrivateResearchCache, writePrivateResearchCache } from '../src/lib/research-tool-private-cache.mjs';

const ownerA = '00000000-0000-4000-8000-000000000001';
const ownerB = '00000000-0000-4000-8000-000000000002';
function fakeStorage() {
  const rows = new Map();
  return {
    rows,
    getItem: key => rows.get(key) ?? null,
    setItem: (key, value) => { rows.set(key, value); },
  };
}

test('private briefing never restores another owner, stale date or corrupt record', () => {
  const s = fakeStorage();
  assert.equal(writePrivateResearchCache(s, 'executive-briefing', ownerA, { strategic_summary: 'PRIVATE_OWNER_A' }), true);
  assert.equal(readPrivateResearchCache(s, 'executive-briefing', ownerA).analysis.strategic_summary, 'PRIVATE_OWNER_A');
  assert.equal(readPrivateResearchCache(s, 'executive-briefing', ownerB), null);
  assert.equal(readPrivateResearchCache(s, 'executive-briefing', ownerA, 'stale day'), null);
  assert.notEqual(privateResearchCacheKey('executive-briefing', ownerA), privateResearchCacheKey('executive-briefing', ownerB));
  s.rows.set(privateResearchCacheKey('executive-briefing', ownerA), '{not json');
  assert.equal(readPrivateResearchCache(s, 'executive-briefing', ownerA), null);
  assert.throws(() => privateResearchCacheKey('executive-briefing', ''), /Authenticated owner/);
});

test('research report explicitly marks model assessment and preserves source identity', () => {
  const report = JSON.parse(buildResearchReport({
    tool: 'research-landscape', query: 'privacy-preserving scientific research',
    analysis: { gap_hypothesis: 'Could privacy change adoption?' },
    sources: [{ source_id: 'W123', title: 'An actual publication record', source: 'OpenAlex', url: 'https://openalex.org/W123', year: 2026 }],
    caveat: 'Not a measured outcome',
  }));
  assert.equal(report.format, 'eylo-research-report-v1');
  assert.match(report.provenance.assessment, /not independently validated/);
  assert.equal(report.sources[0].reference, 'W123');
  assert.equal(report.sources[0].url, 'https://openalex.org/W123');
  assert.equal(report.analysis.gap_hypothesis, 'Could privacy change adoption?');
});

test('research report strips unsafe or credential-bearing citation links', () => {
  const bad = ['javascript:alert(1)', 'https://alice:secret@journal.example.org/x', 'http://unsafe.test', 'https://example.org/\nfoo'];
  const report = JSON.parse(buildResearchReport({ tool: 'impact-review', query: 'Q', analysis: { score: 4 }, sources: bad.map((url, i) => ({ title: 'Paper ' + i, url })) }));
  assert.ok(report.sources.every(s => s.url === null));
  assert.doesNotMatch(JSON.stringify(report.sources), /alice:secret/);
});

test('research report fails closed for absent result and oversized data', () => {
  assert.throws(() => buildResearchReport({ tool: 'research', query: 'Q', analysis: null }), /Completed analysis/);
  const large = JSON.parse(buildResearchReport({ tool: 'research', query: 'Q', analysis: {}, sources: Array.from({ length: 41 }, (_, i) => ({ source_id: 'P' + i })) }));
  assert.deepEqual(large.source_coverage, { retrieved_total: 41, included: 40, omitted: 1, truncated: true });
  assert.equal(large.sources.length, 40);
  assert.equal(large.sources[39].reference, 'P39');
  assert.throws(() => buildResearchReport({ tool: 'research', query: 'Q', analysis: {}, sources: {} }), /Source records must be an array/);
  assert.throws(() => buildResearchReport({ tool: 'research', query: 'Q', analysis: { text: 'x'.repeat(1_100_000) } }), /exceeds 1 MB/);
});
