# Production schema recovery plan — 28 November 2026

## Confirmed catalog evidence

Read-only Supabase catalog inspection on project `kbzjngpzxpniaumlupaa` found PostgreSQL 17.11, 19 recorded migration versions, `public.discovery_rate_limits`, and `public.consume_discovery_rate_limit(p_subject_hash text, p_limit integer, p_window_seconds integer)`. The quota RPC is `SECURITY DEFINER`; `service_role` can execute it and `anon`/`authenticated` cannot. Production lacks `scholarly_provider_state`, `scholarly_provider_leases`, `scholarly_response_cache`, and all four provider-coordination RPCs. The same read-only inspection found the account-token tables `eylo_api_tokens` and `eylo_api_token_events` absent.

The production request trail now confirms one specific failure chain. Vercel logged `EYLO_SCHOLARLY_COORDINATION_UNAVAILABLE { code: 'rpc' }` for `GET /api/discovery` at `2026-11-28T18:16:01.995Z`. Supabase logged a `POST /rest/v1/rpc/read_scholarly_provider_cache` at `2026-11-28T18:16:01.580Z` with HTTP 404 and `PostgREST; error=PGRST202`. The local coordinator maps non-401/403 RPC failures to `rpc`, and `api/discovery.js` maps this coordinator error to HTTP 503. The live catalog independently confirms that the RPC is absent. Together these observations confirm that this request failed because PostgREST could not resolve the missing cache RPC; they do not establish that every 503 has the same cause or that configuration/upstream issues are absent. Vercel environment-variable names were previously observed, but their values and correspondence to the production Supabase project were not inspected.

PostgREST documents PGRST202/404 as a stale function signature or a function absent from the schema cache; in this case the direct catalog query confirms the function is absent, so this is not merely a stale schema cache hypothesis. [PostgREST error reference](https://docs.postgrest.org/en/latest/references/errors.html)

The read-only catalog confirmed all 13 foreign-key constraints named by the candidate index migration are present with the expected local column definitions, and all 13 candidate index names are absent. This supports those indexes as a currently missing optimization set but still requires an immediate target recheck and staging execution. The `learning_lesson_progress` policy is present with the previously observed tautological inner-table `l.course_id = l.course_id`; the composite foreign key enforces lesson/course/user consistency, so this observation alone does not establish a cross-owner bypass. The quota table has RLS enabled and no client policy; anon/authenticated lack direct SELECT, while service_role has SELECT.

The production history is not a direct match for the migration filenames: the 19 recorded versions use different timestamps, and a prior SQL fingerprint audit found 18 exact historical SQL matches plus one known divergent `security_hardening` version. A staging project is not available; the only other connected project is `job`, currently inactive and expressly excluded from use as staging.

## Exact candidate manifest

Machine-readable file: `docs/release/manifests/scholarly-provider-production-recovery-2026-11-28.json`. It pins the SHA-256 of seven candidate migrations and describes their effects/dependencies. The order is the repository's reviewed disposable replay order, not authorization to apply these files to production. In particular, `20261128141000_eylo_api_token_events.sql` depends on `public.eylo_api_tokens`, which is absent from the observed production catalog; this is a hard stop until the prerequisite is resolved and verified.

The coordinator migration itself creates three private RLS-enabled tables, bounds public response-body size at 2 MiB, stores a SHA-256 cache key instead of a raw search query, sets finite cache TTLs, serializes provider slot reservation on provider-state rows, expires abandoned leases, supports cooldown and Retry-After, and grants only four `SECURITY DEFINER` RPCs to `service_role`. It does not change the shared user quota function and introduces no quota bypass.

## Required execution sequence

1. Obtain an independently owned synthetic-data staging Supabase project and matching Preview. Verify both project ref and URL. Do not substitute production or the unrelated inactive `job` project.
2. On staging, collect a read-only schema catalog and full migration history. Compare every applied SQL fingerprint with its source. Stop on unknown versions, divergent SQL, missing dependencies, or object drift. Do not use `migration repair`, rename history entries, or replay the historical baseline blindly.
3. Verify a provider-native database backup or snapshot, retention, point-in-time recovery availability, and the intended recovery point. Restore a copy into an isolated disposable target and prove the restore before any migration.
4. Review each pinned SQL file and prerequisite. Apply only specifically approved follow-up migrations to staging in dependency order with bounded lock and statement timeouts. Stop after the first failure; capture the exact failing statement and catalog state.
5. Run the disposable PostgreSQL coordinator regression and full-local Supabase acceptance. Then run two-account staging checks for owner isolation, Auth deletion, Storage ownership, and unrelated-user data preservation. A fixture, CI pass, or metadata-only report is not hosted acceptance.
6. Capture exact commit, file hashes, staging identity, backup/restore proof, migration logs, post-migration catalog, grants, RLS policies, concurrent request outcomes, real provider responses, and human reviewer. Production remains blocked until the owner separately authorizes a specific rollout.

## Recovery strategy

- Prefer forward-only additive DDL. The policy correction replaces one named policy; index creation is additive; the coordinator migration creates new tables, indexes, and RPCs. No migration should delete researcher records.
- If a transaction fails before commit, verify rollback and compare the schema fingerprint before retrying. Do not continue later migrations.
- Before any writes to a newly created table, rollback may remove only the exact new objects in reverse dependency order after confirming there are no dependent objects or rows. Never use broad `DROP ... CASCADE`.
- After data is written, retain it and repair forward. Do not drop tables or restore a stale snapshot as an application rollback. A point-in-time restore can lose later writes and requires a separate data-loss decision and authorization.
- Roll back application code only if the previous application is compatible with the migrated schema. Code rollback does not undo DDL or data.
- After restore, verify project identity, migration history, schema fingerprint, RLS, grants, Auth/Storage owner relations, and a controlled application smoke before reopening access.

## Disposable test coverage added locally

`tests/integration/scholarly-provider-coordination-postgres.sql` checks all four exact RPC signatures, private-table RLS/grants, `SECURITY DEFINER`/empty `search_path`, service-role execution, client-role denial, cache roundtrip, lease concurrency, duplicate completion denial, and 429 cooldown. Its transaction rolls back test data. The Docker PostgreSQL runner invokes it and exercises two independent concurrent provider reservations. The disposable Supabase preflight workflow runs it after starting the local stack.

This code has not yet run in disposable PostgreSQL/Supabase in the current execution. The current runtime has no `docker`, `psql`, or Supabase CLI. Hosted production was inspected read-only only; no schema, data, account, Auth, Storage, quota, billing, or deployment changes were made.
