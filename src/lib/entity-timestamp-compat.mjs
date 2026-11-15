/**
 * Legacy owner-scoped entity tables use created_at/updated_at rather than
 * created_date/updated_date. Only undefined-column errors on these exact
 * fields permit retrying with the old column names.
 */
export function legacyTimestampColumn(column) {
  if (column === 'created_date') return 'created_at';
  if (column === 'updated_date') return 'updated_at';
  return null;
}

export function canRetryLegacyTimestamp(error, column) {
  return String(error?.code || '') === '42703'
    && Boolean(legacyTimestampColumn(column))
    && String(error?.message || '').includes(column);
}
