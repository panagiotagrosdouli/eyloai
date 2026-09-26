const RESERVED_FIELDS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 'created_date', 'updated_date', 'data',
]);

/** Convert the application's JSONB-backed entity rows into their legacy shape. */
export function rowToEntity(row) {
  if (!row) return null;
  const {
    id, user_id: _userId, created_at: createdAt, updated_at: updatedAt,
    created_date: createdDate, updated_date: updatedDate, data, ...columns
  } = row;

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
