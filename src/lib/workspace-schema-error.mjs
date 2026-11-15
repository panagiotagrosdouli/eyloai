/**
 * Surface deployment/schema drift without pretending an unavailable workspace is empty.
 * Avoid reflecting SQL, table names supplied by untrusted servers, or credentials.
 */
export function workspaceDataError(error) {
  if (!error) return null;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();

  const missingTable = code === '42P01' || code === 'PGRST205'
    || /could not find the table .* in the schema cache/.test(message)
    || /relation [^ ]+ does not exist/.test(message);
  const missingColumn = code === '42703' || code === 'PGRST204'
    || /column [^ ]+ does not exist/.test(message)
    || /could not find the .* column .* in the schema cache/.test(message);

  if (!missingTable && !missingColumn) return error;
  const normalized = new Error(missingTable
    ? 'This EYLO workspace is connected to a database missing a required table. The deployment owner must verify the Supabase project and apply the reviewed migrations.'
    : 'This EYLO workspace has a database schema mismatch. The deployment owner must verify the Supabase project and its reviewed migrations.');
  normalized.name = 'WorkspaceSchemaError';
  normalized.code = 'WORKSPACE_SCHEMA_MISMATCH';
  normalized.status = 503;
  return normalized;
}
