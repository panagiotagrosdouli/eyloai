import { readFile } from 'node:fs/promises';
import { evaluateEyraSchemaReadiness } from '../src/lib/eyra-schema-readiness.mjs';

// Offline only: consumes existing JSON evidence. Never connects to a database,
// executes SQL, writes migrations, or deploys code.
const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/check-eyra-schema-readiness.mjs <private-probe-json>');
  process.exitCode = 1;
} else {
  try {
    const report = JSON.parse(await readFile(path, 'utf8'));
    const result = evaluateEyraSchemaReadiness(report);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.schema_metadata_passed ? 0 : 1;
  } catch {
    console.error('EYRA schema evidence missing or invalid; no release authorized.');
    process.exitCode = 1;
  }
}
