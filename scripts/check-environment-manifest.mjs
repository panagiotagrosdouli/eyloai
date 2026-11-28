import { loadEnvironmentManifest, validateEnvironmentManifest } from '../server/environment-manifest.mjs';

const manifest = await loadEnvironmentManifest();
const errors = validateEnvironmentManifest(manifest, process.env);
const unsafe = errors.filter(message => /secret|vite_/i.test(message));
const structural = errors.filter(message => !unsafe.includes(message));
const report = {
  decision: errors.length ? 'INVALID_CONFIGURATION_MANIFEST' : 'CONFIGURATION_MANIFEST_VALID',
  schema_version: manifest.schemaVersion,
  classified_variable_count: manifest.variables.length,
  unsafe_public_variable_names: unsafe.map(message => message.match(/(?:VITE_[A-Z0-9_]+|SUPABASE_[A-Z0-9_]+)/)?.[0]).filter(Boolean),
  structural_errors: structural,
  note: 'Variable values are never emitted. Presence and service availability are evaluated separately by configuration diagnostics.',
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = errors.length ? 1 : 0;
