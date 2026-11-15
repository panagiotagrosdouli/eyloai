const RESERVED_FIELDS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 'created_date', 'updated_date', 'data',
  'version',
]);

// Business columns retained by the pre-JSONB schema may store arrays as text.
// Prefer canonical JSON values for those fields, never for row identity/version.
const LEGACY_BUSINESS_FIELDS = new Set([
  'title','name','email','full_name','organization','country','research_interests','skills',
  'career_goal','startup_interest','bio','user_type','goal','description','milestones',
  'tasks','notes','status','eyra_analysis','twin_report','eyra_notes','project_id',
  'project_title','call_type','date','time','duration_minutes','participants','agenda',
  'meeting_link','eyra_prep','transcription','authors','summary','year','source','url',
  'institution','research_areas','works_count','citation_count','profile_url','type',
  'query','results_summary',
]);

/** Convert the application's JSONB-backed entity rows into their legacy shape. */
export function rowToEntity(row) {
  if (!row) return null;
  const {
    id, user_id: _userId, created_at: createdAt, updated_at: updatedAt,
    created_date: createdDate, updated_date: updatedDate, data, ...columns
  } = row;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of LEGACY_BUSINESS_FIELDS) if (Object.hasOwn(data, key)) delete columns[key];
  }
  return {
    ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
    ...columns,
    id,
    created_date: createdDate || createdAt || '',
    updated_date: updatedDate || updatedAt || createdDate || createdAt || '',
  };
}

/** All entity fields belong in `data`; only database metadata uses columns. */
export function splitPayload(payload = {}) {
  const data = Object.fromEntries(
    Object.entries(payload || {}).filter(([field, value]) => (
      value !== undefined && !RESERVED_FIELDS.has(field)
    )),
  );
  return { data };
}

/** Supabase `.contains()` maps to JSONB containment on the generic entity data column. */
export function applyEntityFilters(query, filters = {}) {
  return Object.keys(filters).length ? query.contains('data', filters) : query;
}
