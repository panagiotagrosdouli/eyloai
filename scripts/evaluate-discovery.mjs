import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { canonicalRecordId, evaluateQuery, summarize } from './lib/discovery-metrics.mjs';

const [mode, resultsPath, judgmentsPath, outputPath] = process.argv.slice(2);
const usage = 'Usage: node scripts/evaluate-discovery.mjs template <retrieval.json> <labels.json> OR node scripts/evaluate-discovery.mjs evaluate <retrieval.json> <labels.json> [report.json]';
if (!['template', 'evaluate'].includes(mode) || !resultsPath || !judgmentsPath) throw new Error(usage);
const dataset = JSON.parse(await readFile(resolve(resultsPath), 'utf8'));
if (!Array.isArray(dataset.queries)) throw new Error('Retrieval must have {queries:[{id,domain,intent,results:[{id,doi,title,source_index}]}]}.');
const ids = new Set();
for (const query of dataset.queries) {
  if (!query.id || ids.has(query.id) || !Array.isArray(query.results)) throw new Error('Every query needs a unique id and a results array.');
  ids.add(query.id);
}
if (mode === 'template') {
  const template = {
    warning: 'Unjudged template. Assign independent relevance grades before calculating metrics.',
    rubric: { 0: 'Not relevant', 1: 'Partially relevant', 2: 'Directly relevant' },
    judgments: dataset.queries.flatMap(query => query.results.slice(0, 10).map(record => ({
      query_id: query.id,
      record_id: canonicalRecordId(record),
      title: record.title || '',
      grade: null,
      annotator: '',
      note: '',
    }))),
  };
  await mkdir(dirname(resolve(judgmentsPath)), { recursive: true });
  await writeFile(resolve(judgmentsPath), JSON.stringify(template, null, 2) + '\n', { flag: 'wx' });
  console.log(`Created unjudged annotation template: ${judgmentsPath}. No quality metric calculated.`);
} else {
  const payload = JSON.parse(await readFile(resolve(judgmentsPath), 'utf8'));
  if (!Array.isArray(payload.judgments)) throw new Error('Labels require a judgments array.');
  const judgmentsByQuery = new Map();
  for (const label of payload.judgments) {
    if (!ids.has(label.query_id)) throw new Error(`Unknown query ID: ${label.query_id}`);
    if (!label.annotator || !String(label.annotator).trim()) throw new Error(`Missing annotator for ${label.query_id}/${label.record_id}`);
    const labels = judgmentsByQuery.get(label.query_id) || [];
    labels.push(label);
    judgmentsByQuery.set(label.query_id, labels);
  }
  const rows = dataset.queries.map(query => ({
    id: query.id, domain: query.domain, intent: query.intent,
    ...evaluateQuery({ results: query.results, judgments: judgmentsByQuery.get(query.id) || [] }),
  }));
  const byDomain = Object.fromEntries([...new Set(rows.map(row => row.domain))].map(domain =>
    [domain, summarize(rows.filter(row => row.domain === domain))]));
  const byIntent = Object.fromEntries([...new Set(rows.map(row => row.intent))].map(intent =>
    [intent, summarize(rows.filter(row => row.intent === intent))]));
  const report = {
    generated_at: new Date().toISOString(),
    methodology: 'Human judgments of top-10 retrieved records; relevance 0,1,2; P@5 grade>=2; nDCG@10 gains=2^grade-1.',
    caution: 'Metrics refer to this labeled pool and retrieval snapshot, not general scientific validity.',
    overall: summarize(rows), by_domain: byDomain, by_intent: byIntent, per_query: rows,
  };
  console.log(JSON.stringify({ overall: report.overall, by_domain: byDomain, by_intent: byIntent }, null, 2));
  if (outputPath) {
    await mkdir(dirname(resolve(outputPath)), { recursive: true });
    await writeFile(resolve(outputPath), JSON.stringify(report, null, 2) + '\n');
  }
}
