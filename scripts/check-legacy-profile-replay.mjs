import { readFileSync } from 'node:fs';
import { assessLegacyProfileReplay } from './integration/legacy-profile-replay-guard.mjs';

const get = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
try {
  const report = assessLegacyProfileReplay({
    legacyBootstrap: get('tests/integration/legacy-schema-bootstrap.sql'),
    hardeningSql: get('supabase/migrations/20260817090500_security_hardening.sql'),
    bridgeSql: get('supabase/migrations/20261115190203_bridge_legacy_workspace_schema.sql'),
    fingerprints: JSON.parse(get('docs/release/supabase-applied-sql-fingerprints-2026-11-20.json')),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.risks.length === 0) {
    console.error('Historical replay still requires independent staging approval.');
  }
} catch {
  console.error('Legacy profile replay preflight could not be completed; no DB operation was attempted.');
  process.exitCode = 1;
}
