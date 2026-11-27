import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_FIXTURE = new URL('../tests/fixtures/research-evaluation/urban-tree-heat.json', import.meta.url);
const PUBMED_API = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

const norm = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();

export function validateResearchEvaluationFixture(fixture) {
  const issues = [];
  if (fixture?.schema_version !== 1 || fixture?.status !== 'UNJUDGED_PREPARATION_FIXTURE') {
    issues.push('Fixture must remain a version 1 unjudged preparation fixture.');
  }
  const records = Array.isArray(fixture?.records) ? fixture.records : [];
  const recordIds = new Set();
  const pmids = new Set();
  for (const record of records) {
    if (!record?.id || recordIds.has(record.id)) issues.push('Record identifiers must be present and unique.');
    recordIds.add(record?.id);
    if (!/^\d+$/.test(String(record?.pmid || '')) || pmids.has(record?.pmid)) issues.push('PubMed identifiers must be numeric and unique.');
    pmids.add(record?.pmid);
    if (record?.id !== `PMID:${record?.pmid}`) issues.push(`Record ${record?.id || '(missing ID)'} does not bind its local ID to PMID.`);
    if (!/^10\.\d{4,9}\/[\w.()/:;-]+$/i.test(String(record?.doi || ''))) issues.push(`Record ${record?.id} has an invalid DOI shape.`);
    if (record?.registry_url !== `https://pubmed.ncbi.nlm.nih.gov/${record?.pmid}/`) issues.push(`Record ${record?.id} must point to its canonical PubMed record.`);
    if (record?.full_text_url !== `https://pmc.ncbi.nlm.nih.gov/articles/${record?.pmcid}/`) issues.push(`Record ${record?.id} must point to its canonical PMC record.`);
    if (!record?.title || !record?.journal || !Number.isInteger(record?.year) || !Array.isArray(record?.authors) || !record.authors.length) {
      issues.push(`Record ${record?.id} is missing bibliographic fields.`);
    }
  }
  const cases = Array.isArray(fixture?.cases) ? fixture.cases : [];
  const caseIds = new Set();
  for (const item of cases) {
    if (!item?.id || caseIds.has(item.id)) issues.push('Evaluation case IDs must be present and unique.');
    caseIds.add(item?.id);
    if (!item?.stage || !item?.task || !Array.isArray(item?.review_checks) || !item.review_checks.length) {
      issues.push(`Evaluation case ${item?.id || '(missing ID)'} is incomplete.`);
    }
  }
  const requiredStages = ['Scholarly discovery', 'Evidence Matrix', 'Literature Review', 'Research Proposal', 'Methodology', 'Research Roadmap', 'Persistence and export'];
  if (JSON.stringify(cases.map(item => item.stage)) !== JSON.stringify(requiredStages)) issues.push('Cases must cover the end-to-end workflow in the declared sequence.');
  if (fixture?.rating_protocol?.identity_and_traceability === fixture?.rating_protocol?.semantic_support) {
    issues.push('Citation identity checks and semantic support review must remain separate.');
  }
  if (fixture?.rating_protocol?.prohibition?.toLowerCase().includes('not evidence')) {
    // This is an intentional required guard; retain it below.
  } else issues.push('Fixture must state that source-ID resolution is not evidence of claim support.');
  return { valid: issues.length === 0, issues, records: records.length, cases: cases.length, scientific_quality_measured: false };
}

function identifiers(summary) {
  const ids = Array.isArray(summary?.articleids) ? summary.articleids : [];
  return Object.fromEntries(ids.filter(item => item && typeof item.idtype === 'string').map(item => [item.idtype.toLowerCase(), String(item.value || '')]));
}

export async function verifyPubMedRecordIdentity(record, fetchImpl = fetch) {
  const url = new URL(PUBMED_API);
  url.searchParams.set('db', 'pubmed');
  url.searchParams.set('id', record.pmid);
  url.searchParams.set('retmode', 'json');
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!response.ok || !String(response.headers?.get?.('content-type') || '').includes('application/json')) {
    throw new Error('PubMed identity verification could not be completed.');
  }
  const body = await response.json();
  const summary = body?.result?.[record.pmid];
  if (!summary || String(summary.uid) !== record.pmid || norm(summary.title) !== norm(record.title)) {
    throw new Error(`PubMed identity mismatch for ${record.id}.`);
  }
  const ids = identifiers(summary);
  if (norm(ids.doi) !== norm(record.doi)) throw new Error(`PubMed DOI mismatch for ${record.id}.`);
  if (record.pmcid && norm(ids.pmc) !== norm(record.pmcid)) throw new Error(`PubMed PMC identifier mismatch for ${record.id}.`);
  return { id: record.id, identity_verified: true };
}

export async function verifyFixtureAgainstPubMed(fixture, fetchImpl = fetch) {
  const structural = validateResearchEvaluationFixture(fixture);
  if (!structural.valid) throw new Error('Fixture structure is invalid; PubMed checks were not attempted.');
  const verified = [];
  for (const record of fixture.records) verified.push(await verifyPubMedRecordIdentity(record, fetchImpl));
  return { verified_records: verified.length, records: verified, claim_support_verified: false, human_review_completed: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const verifyLive = args.includes('--verify-pubmed');
  const path = args.find(item => item !== '--verify-pubmed');
  try {
    const fixture = JSON.parse(await readFile(path || DEFAULT_FIXTURE, 'utf8'));
    const structural = validateResearchEvaluationFixture(fixture);
    if (!structural.valid) {
      console.log(JSON.stringify(structural, null, 2));
      process.exitCode = 1;
    } else if (verifyLive) {
      console.log(JSON.stringify({ structural, pubmed: await verifyFixtureAgainstPubMed(fixture) }, null, 2));
    } else {
      console.log(JSON.stringify({ ...structural, note: 'Structural checks only. Run with --verify-pubmed to resolve bibliographic identifiers. No scientific claim support or human usability evaluation is measured.' }, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Evaluation fixture validation failed.');
    process.exitCode = 1;
  }
}
