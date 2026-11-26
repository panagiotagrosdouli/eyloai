import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateResearchEvaluationFixture, verifyPubMedRecordIdentity } from '../scripts/validate-research-evaluation-fixture.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/research-evaluation/urban-tree-heat.json', import.meta.url), 'utf8'));

test('authentic-record evaluation fixture covers the workflow without fabricated ratings', () => {
  const result = validateResearchEvaluationFixture(fixture);
  assert.deepEqual(result, { valid: true, issues: [], records: 3, cases: 7, scientific_quality_measured: false });
  assert.ok(fixture.records.every(record => record.registry_url.startsWith('https://pubmed.ncbi.nlm.nih.gov/')));
  assert.ok(fixture.cases.find(item => item.stage === 'Research Roadmap').review_checks.some(check => /separate workplan save/.test(check)));
  assert.match(fixture.rating_protocol.prohibition, /not evidence/i);
});

test('fixture validator rejects citation identity drift and stage omissions', () => {
  const changed = structuredClone(fixture);
  changed.records[0].id = 'PMID:99999999';
  changed.cases.pop();
  const result = validateResearchEvaluationFixture(changed);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => /does not bind its local ID/.test(issue)));
  assert.ok(result.issues.some(issue => /end-to-end workflow/.test(issue)));
});

test('PubMed check binds a record to its exact title, DOI and PMC identifier', async () => {
  const record = fixture.records[0];
  const fetchImpl = async url => {
    assert.equal(new URL(url).hostname, 'eutils.ncbi.nlm.nih.gov');
    assert.equal(new URL(url).searchParams.get('id'), record.pmid);
    return new Response(JSON.stringify({ result: { [record.pmid]: {
      uid: record.pmid,
      title: record.title,
      articleids: [{ idtype: 'doi', value: record.doi }, { idtype: 'pmc', value: record.pmcid }],
    } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  assert.deepEqual(await verifyPubMedRecordIdentity(record, fetchImpl), { id: record.id, identity_verified: true });
  await assert.rejects(() => verifyPubMedRecordIdentity(record, async () => new Response(JSON.stringify({ result: { [record.pmid]: { uid: record.pmid, title: 'Different record', articleids: [] } } }), { status: 200, headers: { 'content-type': 'application/json' } })), /identity mismatch/);
});
