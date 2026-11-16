import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { evaluateFullPlatformReadiness } from '../src/lib/full-platform-readiness.mjs';

const [
  fullPath = 'docs/release/full-platform-readiness-evidence.json',
  marketPath = 'docs/release/market-readiness-evidence.json',
  inventoryPath = 'docs/integration/product-matrix.json',
] = process.argv.slice(2);

try {
  const [full, workspace, inventory] = await Promise.all(
    [fullPath, marketPath, inventoryPath].map(async path => JSON.parse(await readFile(path, 'utf8'))),
  );
  const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const result = evaluateFullPlatformReadiness({
    inventory, workspaceEvidence: workspace, fullEvidence: full, expectedCommit,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === 'READY_FOR_OWNER_REVIEW' ? 0 : 1;
} catch {
  console.error('Full-platform release evidence or repository identity could not be verified. NO-GO.');
  process.exitCode = 1;
}
