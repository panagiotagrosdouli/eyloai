import { readFile, readdir } from 'node:fs/promises';
import { compareMigrationHistory } from './integration/migration-history-diff.mjs';

// Operator supplies an exported, reviewed list of migration versions only.
// No project credentials, network or database connection is used.
const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  console.error('Usage: node scripts/check-remote-migration-history.mjs path/to/remote-versions.json');
  process.exitCode = 2;
} else {
  try {
    const remote = JSON.parse(await readFile(input, 'utf8'));
    const entries = Array.isArray(remote) ? remote : remote?.migrations;
    const directory = new URL('../supabase/migrations/', import.meta.url);
    const local = (await readdir(directory)).filter(name => name.endsWith('.sql'));
    const result = compareMigrationHistory(entries, local);
    console.log(JSON.stringify(result, null, 2));
    if (!result.remote_history_verified) process.exitCode = 1;
  } catch {
    console.error('Migration version comparison failed. No database operation was attempted.');
    process.exitCode = 2;
  }
}
