/**
 * Read-only export of EYLO's canonical user-owned workspace collections.
 * This is NOT a complete GDPR data export: billing, auth provider logs,
 * AI/provider logs, operational backups and other processors are excluded.
 */
export const MAX_WORKSPACE_EXPORT_BYTES = 50 * 1024 * 1024; // 50 MiB maximum local JSON file
const DEFAULT_MAX_TOTAL_ROWS = 50_000;

export class WorkspaceExportSizeError extends Error {
  constructor() {
    super('Workspace export exceeds the safe download size limit. Contact support for an alternative data export.');
    this.name = 'WorkspaceExportSizeError';
    this.code = 'WORKSPACE_EXPORT_SIZE_LIMIT';
  }
}

export const WORKSPACE_EXPORT_TABLES = Object.freeze([
  'projects', 'ideas', 'meetings', 'saved_papers', 'saved_researchers',
  'saved_opportunities', 'search_history', 'watchlists',
  'monitoring_discoveries', 'notifications',
  'notes', 'note_versions', 'life_tasks', 'life_goals', 'calendar_events',
  'study_flashcard_decks', 'activity_events', 'time_entries',
  'quizzes', 'quiz_questions', 'quiz_attempts',
  'learning_courses', 'learning_lessons', 'learning_enrollments', 'learning_lesson_progress',
  'eylo_files', 'eylo_file_versions', 'eyra_conversations', 'eyra_messages', 'grant_applications',
]);

export async function collectWorkspaceExport({
  userId, email = '', userMetadata = null, profile = null, fetchPage,
  pageSize = 200, maxRowsPerTable = 20000,
  maxTotalRows = DEFAULT_MAX_TOTAL_ROWS,
  maxExportBytes = MAX_WORKSPACE_EXPORT_BYTES,
  exportedAt = () => new Date().toISOString(),
}) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Authenticated user identity is required.');
  if (typeof fetchPage !== 'function') throw new TypeError('Read-only page fetcher is required.');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new RangeError('Invalid export page size.');
  if (!Number.isInteger(maxRowsPerTable) || maxRowsPerTable < pageSize) {
    throw new RangeError('Invalid export maximum.');
  }
  if (!Number.isSafeInteger(maxTotalRows) || maxTotalRows < pageSize) {
    throw new RangeError('Invalid total-row safety limit.');
  }
  if (!Number.isSafeInteger(maxExportBytes) || maxExportBytes < 1) {
    throw new RangeError('Invalid export byte safety limit.');
  }
  const encoder = new TextEncoder();
  const encodedLength = value => encoder.encode(JSON.stringify(value)).byteLength;
  let totalRows = 0;
  let estimatedBytes = 0;
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
        totalRows += 1;
        if (totalRows > maxTotalRows) {
          throw new WorkspaceExportSizeError();
        }
        estimatedBytes += encodedLength(row);
        if (estimatedBytes > maxExportBytes) {
          throw new WorkspaceExportSizeError();
        }
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

  const result = {
    format: 'eylo-workspace-json',
    version: 2,
    exported_at: exportedAt(),
    scope: 'authenticated-workspace-only',
    limitations: [
      'Not a complete personal-data access or portability response.',
      'Excludes billing, Supabase Auth internal records, provider logs, operational logs and backups.',
      'File and document metadata/version records are included; uploaded file bytes are not. Download file contents separately from Files.',
      'Data can change during the export; this is not a database transaction snapshot.',
    ],
    account: { user_id: userId, email, user_metadata: userMetadata },
    profile,
    collections,
    record_counts: totals,
  };
  // Metadata, profile and all JSON punctuation also contribute to the final
  // download. Do not silently exceed the limit through user_metadata alone.
  if (encodedLength(result) > maxExportBytes) {
    throw new WorkspaceExportSizeError();
  }
  return result;
}

/**
 * Revalidate the authenticated account immediately before creating the local
 * personal-data file. A user may sign out or switch accounts while the many
 * paginated requests are running. The export must not download old-account
 * data under a new session, even if all the database reads already succeeded.
 */
export function assertWorkspaceExportOwner(originalUserId, currentUser) {
  if (!originalUserId || !currentUser?.id || originalUserId !== currentUser.id) {
    throw new Error('The signed-in account changed during export. No workspace file was created.');
  }
  return true;
}
