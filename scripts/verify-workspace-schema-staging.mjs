import { pathToFileURL } from 'node:url';

const BLOCKED_PROJECT_REFS = new Set([
  'kbzjngpzxpniaumlupaa', // Existing EYLO production — never probe with disposable test writes.
  'umzrggayitzfgrrofjnw', // Unrelated connected Supabase project.
]);

export const WORKSPACE_SCHEMA_CONTRACTS = Object.freeze([
  { table: 'profiles', columns: 'user_id,data' },
  { table: 'projects', columns: 'id,user_id,created_date,updated_date' },
  { table: 'notes', columns: 'id,user_id,created_date,updated_date' },
  { table: 'saved_papers', columns: 'id,user_id,created_date,updated_date' },
  { table: 'saved_opportunities', columns: 'id,user_id,created_date,updated_date' },
  { table: 'life_tasks', columns: 'id,user_id,created_date,updated_date' },
  { table: 'study_flashcard_decks', columns: 'id,user_id,created_date,updated_date' },
  { table: 'calendar_events', columns: 'id,user_id,created_date,updated_date' },
  { table: 'eylo_files', columns: 'id,user_id,project_id,updated_at' },
  { table: 'eylo_file_versions', columns: 'id,user_id,file_id,version_number' },
  { table: 'research_datasets', columns: 'id,user_id,created_date,updated_date' },
]);

/**
 * An isolated staging project must be explicitly confirmed by its owner.
 * This prevents accidentally probing live EYLO or the unrelated connected tenant.
 * No secrets, tokens, URLs or customer records are ever printed.
 */
export function assertStagingSchemaConfig(env) {
  const ref = String(env.EYLO_STAGING_SUPABASE_REF || '');
  const confirmed = String(env.EYLO_STAGING_CONFIRMED_REF || '');
  const url = String(env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publicKey = String(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '');
  const bearer = String(env.EYLO_STAGING_TEST_JWT || '');
  if (env.EYLO_ENVIRONMENT !== 'staging'
    || !/^[a-z0-9]{20}$/.test(ref)
    || ref !== confirmed
    || BLOCKED_PROJECT_REFS.has(ref)
    || url !== `https://${ref}.supabase.co`
    || !publicKey || !bearer) {
    throw new Error('An owner-confirmed, isolated staging Supabase URL, public key, and disposable test-user token are required. Production and unrelated projects are forbidden.');
  }
  return { url, publicKey, bearer };
}

/** Read-only HEAD probes validate table/column visibility through actual PostgREST. */
export async function verifyStagingWorkspaceSchema(env, fetchImpl = globalThis.fetch) {
  const config = assertStagingSchemaConfig(env);
  const results = [];
  for (const { table, columns } of WORKSPACE_SCHEMA_CONTRACTS) {
    let result;
    try {
      const response = await fetchImpl(`${config.url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=1`, {
        method: 'HEAD',
        headers: {
          apikey: config.publicKey,
          authorization: `Bearer ${config.bearer}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      // No body is read; never fetch or log private staging rows.
      result = {
        table,
        status: response.ok ? 'verified' : ([400, 404].includes(response.status) ? 'schema_or_visibility_failure' : 'request_failed'),
        http_status: response.status,
      };
    } catch {
      result = { table, status: 'connection_failed' };
    }
    results.push(result);
  }
  return {
    decision: results.every(row => row.status === 'verified') ? 'PASS' : 'FAIL',
    mode: 'isolated_staging_read_only',
    checked: results.length,
    results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyStagingWorkspaceSchema(process.env)
    .then(result => {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (result.decision !== 'PASS') process.exitCode = 1;
    })
    .catch(() => {
      process.stderr.write('Staging schema preflight refused: verify owner-confirmed staging identity and disposable credentials. Values were not logged.\n');
      process.exitCode = 1;
    });
}
