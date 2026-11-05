/**
 * Read-only export of EYLO's ten user-owned research workspace collections.
 * This is NOT a complete GDPR data export: billing, auth provider logs,
 * AI/provider logs, operational backups and other processors are excluded.
 */
export const WORKSPACE_EXPORT_TABLES = Object.freeze([
  'projects', 'ideas', 'meetings', 'saved_papers', 'saved_researchers',
  'saved_opportunities', 'search_history', 'watchlists',
  'monitoring_discoveries', 'notifications',
]);

export async function collectWorkspaceExport({
  userId, email = '', userMetadata = null, profile = null, fetchPage,
  pageSize = 200, maxRowsPerTable = 20000,
  exportedAt = () => new Date().toISOString(),
}) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Authenticated user identity is required.');
  if (typeof fetchPage !== 'function') throw new TypeError('Read-only page fetcher is required.');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new RangeError('Invalid export page size.');
  if (!Number.isInteger(maxRowsPerTable) || maxRowsPerTable < pageSize) {
    throw new RangeError('Invalid export maximum.');
  }
  const collections = {};
  const totals = {};
  for (const table of WORKSPACE_EXPORT_TABLES) {
    const results = [];
    const seen = new Set();
    let offset = 0;
    while (true) {
      const { data, error } = await fetchPage(table, { offset, limit: pageSize, userId });
      if (error) throw new Error(`Cannot export ${table}: database read failed.`);
      if (!Array.isArray(data)) throw new Error(`Cannot export ${table}: invalid database response.`);
      if (data.length > pageSize) throw new Error(`Cannot export ${table}: unexpected page length.`);
      for (const row of data) {
        if (!row || row.user_id !== userId || typeof row.id !== 'string' || !row.id) {
          throw new Error(`Cannot export ${table}: row ownership or identifier validation failed.`);
        }
        if (seen.has(row.id)) throw new Error(`Cannot export ${table}: unstable pagination returned a duplicate.`);
        seen.add(row.id);
        results.push(row);
      }
      if (results.length > maxRowsPerTable) throw new Error(`Cannot export ${table}: safety limit exceeded.`);
      if (data.length < pageSize) break;
      if (results.length === maxRowsPerTable) {
        // A full final page might be truncated at the configured ceiling.
        // Prefer an explicit failure over silently exporting an incomplete set.
        const extra = await fetchPage(table, { offset: offset + pageSize, limit: 1, userId });
        if (extra.error || !Array.isArray(extra.data) || extra.data.length) {
          throw new Error(`Cannot export ${table}: dataset exceeds export safety limit.`);
        }
        break;
      }
      offset += pageSize;
    }
    collections[table] = results;
    totals[table] = results.length;
  }

  return {
    format: 'eylo-workspace-json',
    version: 1,
    exported_at: exportedAt(),
    scope: 'authenticated-workspace-only',
    limitations: [
      'Not a complete personal-data access or portability response.',
      'Excludes billing, Supabase Auth internal records, provider logs, operational logs and backups.',
      'Data can change during the export; this is not a database transaction snapshot.',
    ],
    account: { user_id: userId, email, user_metadata: userMetadata },
    profile,
    collections,
    record_counts: totals,
  };
}
