# Supabase applied SQL history fingerprint review — 20 November 2026

Read-only production query of `supabase_migrations.schema_migrations.statements[1]` was compared using **the full SQL text**, not filenames, to the canonical GitHub migration contents. No production SQL statements or source text are included in this report beyond controlled public policy differences.

**19 applied migration versions; 18 exact text matches; 1 divergent migration.** All 19 have different timestamps from their local source filenames. [Machine-readable fingerprints](./supabase-applied-sql-fingerprints-2026-11-20.json) and automated local-content regression verify this snapshot (MD5 for comparison, not an authentication or security guarantee). The remote original was checked directly in SQL; later edits to GitHub files fail the local fingerprint tests.

The sole exception: remote `20260817083616_security_hardening` differs from local `20260817090500_security_hardening.sql` on four expressions in the `profiles` SELECT/INSERT/UPDATE RLS policies. **Remote uses `auth.uid() = id`; local uses `auth.uid() = user_id`.** On the observed live schema, `profiles.id` and `profiles.user_id` are NOT NULL, and `profiles_bridge_owner_matches` enforces `id = user_id`, so the presently observed policies agree on row ownership under that constraint. This is **not** a proof of historical SQL equivalence, nor an authorized migration rewrite; approval requires reviewing the constraints, trigger history, grants, RLS tests and bootstrapping order.


## Confirmed historical replay-order hazard

The observed legacy `profiles` shape in `tests/integration/legacy-schema-bootstrap.sql` has an `id` owner column, **not** a `user_id` column. The production-applied `security_hardening` SQL references `id` in its profile RLS policies; the similarly named repository historical migration references `user_id`. The applied security migration predates the `bridge_legacy_workspace_schema` migration that adds `user_id` and enforces `id = user_id`.

Therefore, **replaying the current local `security_hardening.sql` against the original pre-bridge legacy schema would reference a nonexistent column**. Post-bridge owner predicate equivalence does not remove this historic dependency error. The repository adds `node scripts/check-legacy-profile-replay.mjs`, a SQL-free, read-only guard and unit tests that keep this ordering hazard explicit. It is **not a substitute for a production-history reconstruction**, and it always marks historical remote application unauthorized.

Do not alter production RLS policies or the original migration filename to work around this. Reconstruct the exact original SQL and history on disposable approved staging before considering an archival/metadata reconciliation.

Importantly, this evidence **does not fix the Supabase branch** `MIGRATIONS_FAILED`. The branch workflow reports `Remote migration versions not found in local migrations directory.` Correcting history requires review of each exact original SQL, migration version mapping and branch replay strategy. Never simply insert/rename files or call `migration repair` to mask differences, and never apply these files again to production.

Before staging release, validate the historical SQL equivalence review with responsible owner sign-off, a disposable branch replay, the security advisor, two-user positive/negative RLS tests, and database snapshot/rollback planning. No approval for production DDL is conveyed.

This is an auditable read-only record related to [#573](https://github.com/panagiotagrosdouli/eyloai/issues/573).
