# Security implementation evidence — issue #291 (initial tranche)

Status: **partial implementation; NOT production-accepted**.

## Repository changes
- Added authenticated, page-oriented `/api/privacy-export` with fixed collection allowlist, 200-row pages, backend-derived identity via `/auth/v1/user`, server-side `user_id` filter, no-store and fail-closed errors.
- Added Settings → Privacy → Download My Data JSON aggregation. Any failed collection prevents a file from being generated.
- Added offline negative tests for anonymous requests, arbitrary collections, supplied cross-user IDs and data source failure.
- Added baseline Vercel HSTS, referrer, framing, MIME sniffing and Permissions-Policy response headers. Deployment verification remains outstanding.

## Operational blockers (do not bypass)
- The connected Supabase listing exposes only project `umzrggayitzfgrrofjnw` (inactive), **not** the project `kbzjngpzxpniaumlupaa` referenced by this application's URL and migrations. No database writes or two-user RLS tests were run.
- Server export intentionally requires an exact matching HTTPS Supabase URL and server-only secret key. A mismatched or missing configuration produces 503 instead of using an implicit default.
- Export coverage is **not a complete GDPR Article 15/20 package**: app storage objects, Stripe invoices and hosted billing records, AI provider-held requests/logs, backups, security logs and device-local preferences are excluded. User-facing copy explicitly lists exclusions. No claim of full portability/completeness should be made.
- The current database schema has not been introspected against production. If a required collection/table is absent or has a different ownership column, the export fails instead of silently omitting it. In particular, reconcile any existing `profiles` schema using `id` versus `user_id` before rollout.
- Vercel TLS certificate, negotiated TLS protocol, redirects, live response headers, storage encryption and exact retention periods were **not independently verified**.
- Account deletion is **not implemented**. This branch does not create any destructive endpoint, change production data, revoke sessions or alter billing subscriptions.

## Release acceptance
1. Obtain read-only access to the **intended** production project and a separate verified staging project; review applied migrations, tables, RLS and grants.
2. Test export with two disposable identities, over 200 rows per collection, deliberately failed collection, empty records and inaccessible storage. Validate expected ownership and coverage; extend export to eligible storage/provider data.
3. Implement server-side, journaled and idempotent account deletion with fresh authentication, subscription handling, retention inventory, audit records and safe retry. Never test deletion with a real user.
4. Run repository CI, negative API tests, browser E2E, staging deployment and live HTTPS/TLS and response header checks. Record the precise commit and project URL.
5. Obtain legal review of privacy notice/terms and GDPR retention obligations before describing the service as compliant or production-ready.
