import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { evaluateReleaseReadiness } from '../src/lib/release-readiness.mjs';
const path = process.argv[2] || 'docs/release/market-readiness-evidence.json';
let input;
let loaded = false;
try { input = JSON.parse(await readFile(path, 'utf8')); loaded = true; }
catch { console.error('Release evidence could not be read. No release is authorized.'); process.exitCode = 1; }
if (loaded) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const result = evaluateReleaseReadiness(input, { expectedCommit: commit });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === 'READY_FOR_OWNER_REVIEW' ? 0 : 1;
}
