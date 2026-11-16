import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createEyraQualityReport } from '../src/lib/eyra-quality-report.mjs';

const [mode, inputPath, outputPath] = process.argv.slice(2);
const help = 'Usage: node scripts/evaluate-eyra-quality.mjs template <labels.json> OR node scripts/evaluate-eyra-quality.mjs evaluate <labels.json> [report.json]';

if (mode === 'template' && inputPath) {
  const template = {
    notice: 'UNJUDGED TEMPLATE. Obtain human review of original source text. Remove identifying or private data before saving.',
    rubric: {
      matchesRetrievedRecord: 'Human checked exact source identity against the frozen retrieval packet',
      supportedBySource: 'Human read the original evidence and judged the specific claim supported',
      noUsableEvidence: 'No usable, independently checkable evidence was available',
      disclosedNoEvidence: 'EYRA explicitly told the user the evidence was missing',
    },
    cases: [
      {
        id: 'REPLACE_WITH_UNIQUE_CASE_ID',
        reviewerId: 'REPLACE_WITH_PSEUDONYMOUS_REVIEWER_CODE',
        domain: 'REPLACE_WITH_RESEARCH_DOMAIN',
        citations: [{ id: 'P1', matchesRetrievedRecord: null }],
        claims: [{ supportedBySource: null }],
        noUsableEvidence: null,
        disclosedNoEvidence: null,
        unauthorizedWrites: null,
        duplicateWrites: null,
      },
    ],
  };
  await writeFile(resolve(inputPath), JSON.stringify(template, null, 2) + '\n', { flag: 'wx' });
  console.log('Created unjudged reviewer template. No scientific quality was measured.');
} else if (mode === 'evaluate' && inputPath) {
  const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  const report = createEyraQualityReport(input);
  console.log(JSON.stringify(report, null, 2));
  if (outputPath) {
    // Never export case content, research queries, user identifiers or source URLs.
    await writeFile(resolve(outputPath), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log('Saved aggregate-only report without underlying research content.');
  }
} else {
  throw new Error(help);
}
