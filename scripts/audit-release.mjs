import { readFileSync } from 'node:fs';
import { assessEyloRelease } from '../src/lib/release-readiness.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--snapshot') {
  console.error('Usage: npm run audit:release -- --snapshot /path/to/read-only-snapshot.json');
  console.error('No network calls, credential reads, deployments or database writes. Provide ONLY env key names, not values.');
  process.exitCode = 2;
} else {
  try {
    const snapshot = JSON.parse(readFileSync(args[1], 'utf8'));
    const result = assessEyloRelease(snapshot);
    console.log(JSON.stringify(result, null, 2));
    if (result.decision !== 'REQUIRES_INDEPENDENT_FINAL_SIGNOFF') process.exitCode = 1;
  } catch (error) {
    console.error('Release audit could not be completed: ' + (error instanceof Error ? error.message : 'Invalid snapshot.'));
    process.exitCode = 2;
  }
}
