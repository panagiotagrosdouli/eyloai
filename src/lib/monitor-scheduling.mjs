/**
 * Build a bounded, fair PostgREST watchlist selection.
 *
 * Filter disabled rows BEFORE LIMIT; otherwise 30 old disabled watchlists
 * can indefinitely block every active watchlist. updated_date is refreshed
 * by the repo's set_updated_date trigger after each successful/failed check.
 *
 * PostgREST JSON-path conditions use ->> to compare text values and OR to
 * include legacy rows without an explicit active flag.
 */
export const MAX_WATCHLISTS_PER_RUN = 30;

export function monitorWatchlistsQuery(limit = MAX_WATCHLISTS_PER_RUN) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_WATCHLISTS_PER_RUN) {
    throw new RangeError('Invalid monitoring watchlist limit.');
  }
  const query = new URLSearchParams({
    select: 'id,user_id,data',
    or: '(data->>active.is.null,data->>active.neq.false)',
    order: 'updated_date.asc,id.asc',
    limit: String(limit),
  });
  return `watchlists?${query}`;
}
