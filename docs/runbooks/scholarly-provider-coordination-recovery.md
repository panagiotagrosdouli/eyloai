# Scholarly provider coordination recovery

Scope: restore the existing migration `20261128145000_scholarly_provider_coordination.sql` on the EYLO Supabase project. This is an additive database recovery; it does not change the discovery gateway, quotas, provider endpoints, or production deployment.

## Current production preflight (read only)

Executed `supabase/recovery/scholarly_provider_coordination_preflight.sql` against project `kbzjngpzxpniaumlupaa` on 2026-11-28. Result:

- Migration version `20261128145000` is absent from `supabase_migrations.schema_migrations`.
- All three tables and all four exact-signature RPCs are absent. No partial installation, signature collision, or incompatible object was found.
- `service_role` has `USAGE` on `public`.
- Preflight verdict: `SAFE_CANDIDATE_ONLY_AFTER_STAGING_AND_BACKUP`.

This is a catalog snapshot. It is not evidence that production is repaired, that the SQL has been replayed in isolation, or that any provider returns results.

## Migration dependency and security contract

The migration depends on the Supabase roles `anon`, `authenticated`, and `service_role`, the `public` schema, and PostgreSQL built-ins (`gen_random_uuid`, advisory locks, timestamps, and standard PL/pgSQL functions). It uses no application tables, data backfill, external extension, or secret. The project runs PostgreSQL 17.11.

It creates three tables:

- `scholarly_provider_state`: one pacing/cooldown row per allowlisted provider; provider and failure-count checks.
- `scholarly_provider_leases`: leases reference provider state with `ON DELETE CASCADE`; lease expiry index and SHA-256 cache-key check.
- `scholarly_response_cache`: bounded response body, provider/content-type checks, expiry index, and SHA-256 cache-key check.

It enables RLS on all three tables, creates no policies, revokes direct table access (including `service_role`), then grants `service_role` execute on exactly four `SECURITY DEFINER` RPCs. Each function pins `search_path` to empty. Never add direct table grants, public policies, anonymous RPC execute, or a fallback that skips quota/leases.

## Safe recovery sequence

1. **Obtain an isolated target.** Use an owner-approved free project/organization with no production data, or an already provisioned disposable CI Supabase stack. Do not use the production project's `main` development branch (`MIGRATIONS_FAILED`) or the unrelated inactive `job` project. The connected organization is Free and currently has no spare project slot; no free isolated Supabase target is available in the connected account.
2. **Record backup and recovery evidence.** Before any production DDL, the owner must verify the Supabase backup/PITR restore point and retention in the dashboard, record its UTC time and restore procedure, and test a full restore into an isolated project. Disposable CI acceptance separately created a targeted data-only dump of the three coordination tables, truncated those tables, restored the dump, and verified cache and lease behavior. This is not a full-project backup/PITR inspection or production restore. Since this migration has no user rows to backfill, forward repair is preferred; a database restore is a last resort and requires separate owner authorization because it can roll back unrelated writes.
3. **Run read-only preflight** on the isolated target and retain its JSON report. Require the migration version to be absent and every expected table/function to be absent. If any target object exists, if a signature differs, or if the migration ledger and catalog disagree, stop. Compare object owners, columns/defaults, all constraint definitions, indexes, RLS/policies, and ACLs with the source migration. Do not run the file on a partial schema.
4. **Apply only this migration in one transaction** on the isolated target. The local repository has other pending historical migrations, so do not run `supabase db push` against a target whose inventory shows those pending versions. Apply the complete committed file verbatim in a single `psql --single-transaction --set ON_ERROR_STOP=1` operation to the explicitly selected isolated project. The disposable CI workflow piped the SHA-pinned committed bytes to PostgreSQL in one transaction. Only after schema postflight and source-body comparison succeed, record this exact version with `supabase migration repair --status applied 20261128145000 --remote`; that command updates the history table only and must never precede actual DDL application. Confirm the intended remote project before each command; do not mark any older version applied.
5. **Verify schema and policy.** Rerun preflight. Inspect exact `pg_get_functiondef` output against the committed file; require exact RPC signatures/results/default argument count, SECURITY DEFINER, empty search path, trusted owner, execute for `service_role` only, RLS enabled, no table policies, no direct role grants, expected checks/FK/PK/indexes, and a matching migration-ledger row.
6. **Exercise actual coordination behavior with synthetic data only.** Through RPC calls, test empty cache → write → exact read; expiry; provider allowlist and input rejection; reservation acquisition; same-key deduplication; minimum interval; max-concurrency boundary under simultaneous requests; lease completion/removal; Retry-After cooldown after 429; bounded server-error cooldown; and a later successful response clearing failures. Use unique 64-hex synthetic keys. Finish each acquired lease and confirm no test rows remain except the expected provider state. Do not call scholarly providers in these database-only tests.
7. **Exercise authorization both ways.** As `service_role`, require RPC execution success and direct table access denial. As `anon` and an authenticated user, require all four RPC calls and all table access to be denied. Verify catalog grants and RLS/policies as well as actual HTTP/PostgREST role behavior; never expose credentials in CI logs.
8. **Verify recovery behavior.** Disposable CI injected a failure after the first table creation inside the single PostgreSQL transaction and verified that the migration ledger and all seven target objects remained absent. It then applied the complete migration transactionally and reconciled only version `20261128145000` with local `supabase migration repair`. This verifies PostgreSQL rollback for this test sequence; it does not establish atomicity between remote DDL and a later remote ledger repair. Keep the production forward-only reconciliation gate.
9. **Only then consider production.** Rerun the same read-only preflight immediately before change. A production operation requires a separate explicit owner authorization naming project `kbzjngpzxpniaumlupaa`, the exact migration file/version, a verified backup restore point, and an approved maintenance/recovery window. Apply only that migration once. No production database change is authorized by the current task.
10. **Post-change acceptance.** Repeat preflight, verify the migration ledger and runtime grants, and verify no other pending migration was applied. Then issue a bounded real discovery request through EYLO. Confirm provider logs/results, request quota accounting, cache reuse, Retry-After behavior, real DOI resolution metadata, duplicate elimination, and that no source is claimed when unavailable. This must be hosted acceptance; local tests alone cannot establish it.

## Exact production operation reserved for owner approval

If and only if the isolated transaction replay passes and the immediate production preflight reports all seven objects missing, the ledger version absent, no name/signature collision, no incompatible object, and the owner confirms the backup restore point, the sole intended DDL is the verbatim contents of:

`supabase/migrations/20261128145000_scholarly_provider_coordination.sql`

The proposed production sequence is: run that exact file once in a single transaction against the explicitly named project; rerun schema postflight and compare function bodies; then run `supabase migration repair --status applied 20261128145000 --remote` to reconcile only this version in Supabase's ledger. Never run `db push` while the older pending migration inventory remains unreconciled, and never use `migration repair` as a substitute for applying DDL. This two-step change is **not authorized or executed**. If preflight ever reports a partial or incompatible object, this operation is cancelled until an owner-reviewed reconciliation migration is prepared.

## Acceptance matrix

| Area | Required evidence | Current status |
|---|---|---|
| Production schema state | Read-only preflight catalog JSON | PASS: migration ledger absent; all 3 tables and 4 exact RPCs missing; no collision |
| Full migration replay | Exact SHA-pinned migration replay in disposable Supabase | PASS: CI `EYRA schema preflight` run `46183610727`, job `141098479950`; schema preflight, injected rollback, one-transaction apply, version-only ledger reconciliation, catalog contracts, PostgREST and full existing local acceptance all passed. This is disposable CI, not hosted staging. |
| Cache, leases, cooldown, concurrency | Synthetic RPC workflow described above | PASS in disposable CI job `141098479950`: cache miss/write/read/expiry; lease acquire/dedup/complete; 2-of-8 concurrency; provider pacing; 429 and 5xx cooldown/recovery; shared quota 3-of-8. |
| Positive/negative authorization | Service-role and anon/authenticated HTTP tests | PASS in disposable CI job `141098479950`: anon and authenticated RPC/table denial, service-role RPC success and direct-table denial; catalog ACL/RLS checks passed. |
| Backup, restore, forward recovery | Owner-verified restore point and isolated restore plus interruption test | Targeted disposable table-data dump/restore and interrupted-transaction rollback PASS in CI job `141098479950`. Full-project backup/PITR verification and isolated full restore remain NOT VERIFIED and are required before production DDL. |
| Production migration | Separate owner authorization required | NOT AUTHORIZED; not run. Production preflight must be repeated immediately before change; a verified full restore point and explicit owner authorization naming the project/file/version/window remain required. |
| Scholarly result/DOI verification | Live bounded EYLO search after schema repair | BLOCKED until separately authorized production recovery and hosted acceptance; disposable synthetic fixtures do not verify real provider results or DOI metadata. |

## Rollback and forward recovery

Do not drop the new tables or functions automatically. They hold only provider pacing state, transient leases, and public-result cache; removing them can break active discovery requests and erase cooldown protection. On an error, stop provider traffic only through the existing supported maintenance controls if necessary, capture the sanitized migration error and preflight report, and check both the ledger and all seven object states. If the transaction and ledger rolled back and every object remains absent, rerun only the exact migration after the cause is fixed and approval is still valid. If any object or ledger entry remains, do not rerun; use an owner-reviewed, forward-only reconciliation migration. Restore the database only from the verified point-in-time procedure and only with separate approval.
