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
2. **Record backup and recovery evidence.** Before any production DDL, the owner must verify the Supabase backup/PITR restore point and retention in the dashboard, record its UTC time and restore procedure, and test restore into an isolated project. This task did not create, inspect, or restore a backup. Since this migration has no user rows to backfill, forward repair is preferred; a database restore is a last resort and requires separate owner authorization because it can roll back unrelated writes.
3. **Run read-only preflight** on the isolated target and retain its JSON report. Require the migration version to be absent and every expected table/function to be absent. If any target object exists, if a signature differs, or if the migration ledger and catalog disagree, stop. Compare object owners, columns/defaults, all constraint definitions, indexes, RLS/policies, and ACLs with the source migration. Do not run the file on a partial schema.
4. **Replay the exact existing migration once** on the isolated target using the normal Supabase migration mechanism so the version is recorded. Use the committed SQL verbatim; do not use `db push --include-all`, replay older pending migrations, or mark the version applied without applying it.
5. **Verify schema and policy.** Rerun preflight. Inspect exact `pg_get_functiondef` output against the committed file; require exact RPC signatures/results/default argument count, SECURITY DEFINER, empty search path, trusted owner, execute for `service_role` only, RLS enabled, no table policies, no direct role grants, expected checks/FK/PK/indexes, and a matching migration-ledger row.
6. **Exercise actual coordination behavior with synthetic data only.** Through RPC calls, test empty cache → write → exact read; expiry; provider allowlist and input rejection; reservation acquisition; same-key deduplication; minimum interval; max-concurrency boundary under simultaneous requests; lease completion/removal; Retry-After cooldown after 429; bounded server-error cooldown; and a later successful response clearing failures. Use unique 64-hex synthetic keys. Finish each acquired lease and confirm no test rows remain except the expected provider state. Do not call scholarly providers in these database-only tests.
7. **Exercise authorization both ways.** As `service_role`, require RPC execution success and direct table access denial. As `anon` and an authenticated user, require all four RPC calls and all table access to be denied. Verify catalog grants and RLS/policies as well as actual HTTP/PostgREST role behavior; never expose credentials in CI logs.
8. **Verify recovery behavior.** Simulate an interrupted transaction on the disposable target. Establish whether the chosen Supabase migration runner applies DDL transactionally and whether the version ledger commits atomically. If any partial state can remain, document a forward-only owner-approved repair for each failure point; do not assume rollback.
9. **Only then consider production.** Rerun the same read-only preflight immediately before change. A production operation requires a separate explicit owner authorization naming project `kbzjngpzxpniaumlupaa`, the exact migration file/version, a verified backup restore point, and an approved maintenance/recovery window. Apply only that migration once. No production database change is authorized by the current task.
10. **Post-change acceptance.** Repeat preflight, verify the migration ledger and runtime grants, then issue a bounded real discovery request through EYLO. Confirm provider logs/results, request quota accounting, cache reuse, Retry-After behavior, real DOI resolution metadata, duplicate elimination, and that no source is claimed when unavailable. This must be hosted acceptance; local tests alone cannot establish it.

## Exact production operation reserved for owner approval

If and only if the isolated replay passes and the immediate production preflight reports all seven objects missing, the ledger version absent, no name/signature collision, and the owner confirms the backup restore point, the sole intended DDL is the verbatim contents of:

`supabase/migrations/20261128145000_scholarly_provider_coordination.sql`

Apply it once through the normal Supabase migration mechanism with version/name `20261128145000_scholarly_provider_coordination`; do not paste a reconstructed or idempotent variant. This step is **not authorized or executed**. If preflight ever reports a partial or incompatible object, this operation is cancelled until an owner-reviewed reconciliation migration is prepared.

## Acceptance matrix

| Area | Required evidence | Current status |
|---|---|---|
| Production schema state | Read-only preflight catalog JSON | PASS: migration ledger absent; all 3 tables and 4 exact RPCs missing; no collision |
| Full migration replay | Isolated Supabase replay of exact migration | BLOCKED: no connected free staging capacity; existing dev branch is `MIGRATIONS_FAILED` |
| Cache, leases, cooldown, concurrency | Synthetic RPC workflow described above | NOT RUN in disposable target |
| Positive/negative authorization | Service-role and anon/authenticated HTTP tests | Migration CI previously tested grants/RLS on disposable PostgreSQL; this package's full role matrix still requires isolated Supabase |
| Backup, restore, forward recovery | Owner-verified restore point and isolated restore plus interruption test | NOT VERIFIED |
| Production migration | Separate owner authorization required | NOT AUTHORIZED; not run |
| Scholarly result/DOI verification | Live bounded EYLO search after schema repair | BLOCKED until production repair and hosted acceptance |

## Rollback and forward recovery

Do not drop the new tables or functions automatically. They hold only provider pacing state, transient leases, and public-result cache; removing them can break active discovery requests and erase cooldown protection. On an error, stop provider traffic only through the existing supported maintenance controls if necessary, capture the sanitized migration error and preflight report, and check both the ledger and all seven object states. If the transaction and ledger rolled back and every object remains absent, rerun only the exact migration after the cause is fixed and approval is still valid. If any object or ledger entry remains, do not rerun; use an owner-reviewed, forward-only reconciliation migration. Restore the database only from the verified point-in-time procedure and only with separate approval.
