# Scholarly provider coordination recovery — owner runbook

**Status: prepared; production execution is not authorized.** This procedure targets only the missing coordination migration. It does not authorize a general migration push, history repair of other versions, quota bypass, or a change to production data.

## Current evidence

- Production project ref: `kbzjngpzxpniaumlupaa` (confirm independently in the Supabase dashboard before any command).
- The read-only catalog snapshot records 19 applied migration versions and does not contain migration `20261128145000`.
- The three coordination tables and four RPCs are absent in the recorded production catalog. The request path currently stops at the missing cache RPC before contacting a scholarly index.
- Source: `supabase/migrations/20261128145000_scholarly_provider_coordination.sql`, SHA-256 `aefd33f4589ec8201245e95611e11294de455cc745c6f082b2687c5166e69d53`.
- The SQL is non-idempotent. It creates only three coordination tables, their indexes, and four RPCs; cache/lease state starts empty. It does not alter existing application tables or rows.
- Local repository inventory has seven pending migrations and historical filename/version differences. A generic `supabase db push` or `supabase migration up` would not be a safe targeted operation.

## Zero-additional-infrastructure acceptance

The existing `EYRA Schema Preflight` GitHub Actions workflow starts a fresh Supabase CLI stack on a GitHub-hosted runner, replays the SHA-pinned canonical local-only migration plan, and removes the stack afterward. Its `full-local-supabase-acceptance` job is the zero-additional-infrastructure option for repeatable disposable database verification. It is **not hosted staging**, does not contain production data, and cannot establish production migration compatibility or hosted acceptance. No separate free hosted Supabase staging project is currently available in the connected organization; the unrelated `job` project is out of scope.

## Required stop/go gates

Proceed only after all of these are documented by the database owner:

1. An isolated hosted staging project is available, or the owner explicitly approves a different staging strategy and documents the residual risk.
2. Exact staging and production project identities are independently confirmed. The production identity must be `kbzjngpzxpniaumlupaa`.
3. The exact production migration ledger, current coordination-object inventory, and relevant grants/RLS are re-read from the target immediately before change. Do not infer current state from this document.
4. A current, restorable database backup/snapshot is confirmed, with a recovery contact and restore plan.
5. The migration file SHA-256 above matches the reviewed file.
6. Disposable and hosted staging acceptance both pass, including eight-client concurrency, lease release/expiry, duplicate suppression, cache read/write/expiry, 429 cooldown, and privilege checks.
7. The owner approves the exact single-migration procedure below. This runbook itself is not approval.

Abort if any coordination object exists partially, if migration history differs from the preflight, if the target identity cannot be proven, if the file hash differs, or if the backup/restore check is incomplete. Do not add `IF NOT EXISTS`, edit production objects ad hoc, mark a migration applied before executing and verifying its SQL, or run all pending migrations to clear the branch error.

## Prepared targeted production operation — not executed

Use a reviewed checkout and a secret manager/environment injection for the connection string. Never put a database password in command history, logs, a PR, or chat. First verify `sha256sum` and rerun the read-only catalog preflight on the explicitly confirmed production target. Then, only after separate owner authorization:

```sh
psql "$EYLO_PRODUCTION_DATABASE_URL" \
  --set ON_ERROR_STOP=on \
  --single-transaction \
  --file supabase/migrations/20261128145000_scholarly_provider_coordination.sql
```

The single transaction makes a SQL error roll back the DDL as a unit. If it fails, stop; do not mark the migration applied. After commit, verify all three tables have RLS enabled, no API-role direct grants or row policies, and all four `SECURITY DEFINER` RPCs are executable only by `service_role`. Verify the exact signatures and exercise a normal bounded request only under separate owner authorization.

Once the committed objects have been independently verified, repair **only** this history entry so the ledger matches the actual schema:

```sh
supabase migration repair 20261128145000 --status applied --remote "$EYLO_CONFIRMED_PRODUCTION_REF"
```

The Supabase CLI documents that `migration repair` changes the migration history record only; it does not run SQL. Therefore the SQL operation must complete and be verified first. Confirm the CLI target output and migration version before accepting its confirmation prompt. Do not add `--yes` to an unattended command. Re-read the migration list and object/grant catalog after the history update.

## Post-change acceptance and data recovery

Run at most one normal, privacy-safe scholarly discovery request after owner authorization. Accept recovery only if the response contains real source records with stable identifiers and source URLs, provider attribution, and no fabricated evidence; record provider statuses and safe request diagnostics. Do not bypass shared rate limits or repeat requests to force a result. Then verify EYRA's evidence selection and citation provenance against those returned source records.

This migration preserves existing application rows by design and has no destructive data statements. The lease/cache tables begin empty and fill only with short-lived provider coordination state. If post-commit checks fail, pause further changes and use the owner-approved restore/recovery plan; do not automatically drop coordination objects while application traffic could be using them.

**Current decision: NO-GO.** No isolated hosted staging project or separate production-migration authorization is present. No production DDL, migration-history edit, provider request, backup, or data write was performed for this runbook.

### Supabase CLI references

- [Deploy database migrations](https://supabase.com/docs/guides/deployment/database-migrations) — `db push` applies pending local migrations; `migration repair` updates history only.
- [CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-repair) — remote migration-history repair syntax and confirmation behavior.
