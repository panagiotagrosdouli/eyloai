# Scheduled monitoring — bounded fair watchlist rotation

**Status: code-level mitigation only, not production-enabled monitoring.**

## Why this change

The previous scheduler performed `order=updated_date.asc&limit=30` on
**all watchlists**, and only then removed `data.active === false` rows
in JavaScript. Thus a set of 30 oldest inactive rows could consume
the entire batch forever, preventing all active queries from running.
Similarly, an active watchlist without a valid search query returned
early without updating `updated_date`, potentially starving others.

The corrected query uses PostgREST JSON-path filters to select eligible
rows **before** applying `limit=30`:

```
or=(data->>active.is.null,data->>active.neq.false)
order=updated_date.asc,id.asc
limit=30
```

The `is.null` clause retains legacy watchlists where the active
property is absent. The `neq.false` clause excludes explicit
inactive watchlists. The secondary ID order makes identical
timestamps deterministic.

The existing `watchlists_set_updated_date` trigger on every PATCH
rotates completed and failed watchlists to the end of the queue.
Empty-query watchlists now get a recorded `invalid_query` status
and a timestamp update **without contacting an external provider**.

Unit tests use a simulated PostgREST server and the actual monitor
handler, with **40 disabled + 66 eligible** watchlists. They verify that
all 66 are handled in three 30-item runs, legacy watchlists are
included, empty queries are recorded, and disabled ones never cause
upstream requests.

## Release and test limitations

- The PostgREST JSON filter syntax is documented at
  https://docs.postgrest.org/en/stable/references/api/tables_views.html .
- Actual migrations, trigger installation, RLS and schema compatibility
  must be inspected in the **correct** production-linked Supabase
  project before any real cron is enabled; migration source alone does
  not establish deployed behavior.
- If a watchlist's status PATCH fails, fairness is not guaranteed:
  the endpoint returns a retryable failure, and the operator must
  fix the database issue rather than treating monitoring as healthy.
- Watchlists are limited to 30 checks per invocation, with batches of
  five. That is **not** a promise of daily coverage when there are
  more than 30 eligible lists; SLOs, cron runtime and scaling must
  be validated separately under real provider limits.
- The scheduled monitoring capability is still **disabled** until
  verified opt-in and access/credential review. This patch does not
  authorize sending researcher queries to external providers.

Do not turn on the cron or alter any production data based solely
on synthetic tests. Production monitoring remains NO-GO.
