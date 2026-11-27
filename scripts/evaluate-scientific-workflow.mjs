#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { evaluateScientificPacket } from '../src/lib/scientific-evaluation.mjs';

const [mode, inputPath, outputPath] = process.argv.slice(2);
const usage = 'Usage: node scripts/evaluate-scientific-workflow.mjs evaluate <packet.json> [aggregate-report.json]';
if (mode !== 'evaluate' || !inputPath) {
  console.error(usage);
  process.exitCode = 2;
} else {
  try {
    const packet = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
    const actualCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const report = evaluateScientificPacket(packet, { expectedCommit: actualCommit });
    console.log(JSON.stringify(report, null, 2));
    if (outputPath) await writeFile(resolve(outputPath), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    // Unjudged or invalid material cannot masquerade as a successful acceptance gate.
    process.exitCode = report.valid && report.gate === 'REVIEW_DATA_COMPLETE_PENDING_INDEPENDENT_ACCEPTANCE' ? 0 : 1;
  } catch (error) {
    console.error('Scientific evaluation packet could not be validated: ' + (error?.code || error?.name || 'invalid input'));
    process.exitCode = 2;
  }
}
