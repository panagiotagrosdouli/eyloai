# Scholarly coordination recovery

This package covers one existing migration and synthetic disposable acceptance. It contains no production target identifiers or live operational telemetry.

## Pinned migration

- File: `supabase/migrations/20261128145000_scholarly_provider_coordination.sql`
- Version: `20261128145000`
- SHA-256: `aefd33f4589ec8201245e95611e11294de455cc745c6f082b2687c5166e69d53`
- Source of the pin: `docs/release/manifests/scholarly-provider-coordination.json`

The migration creates three provider coordination/cache tables, enables RLS without client policies, denies direct table privileges, and grants the four `SECURITY DEFINER` RPCs to `service_role` only. The RPCs pin `search_path` to the empty path. The existing user discovery quota stays separate and mandatory.

## Disposable acceptance

The GitHub workflow constructs an unlinked local Supabase project from the reviewed migration plan and verifies each migration hash before replay. The coordination migration keeps its exact version in the local migration ledger; surrounding legacy migration versions are assigned unique ordered values only inside that disposable project.

The acceptance checks cover:

1. Exact migration SHA and exact version in the migration ledger.
2. Read-only preflight of relation shape, constraints, indexes, RLS, policies, grants, RPC signatures, owners, security mode, search path, and function ACLs.
3. An injected failure after the migration and ledger insert; after connection rollback, no migration objects or ledger record may remain.
4. Successful transaction replay, cache roundtrip, rate limits, deduplication, lease contention, lease completion, 429 cooldown, and negative client-role authorization.
5. A disposable custom-format database dump restored into a separate local database, followed by verification of the synthetic cache record and migration ledger.
6. Local Auth, PostgREST, Storage, and two-user fixture workflows restricted to loopback services.

These checks validate the migration and database tooling on disposable infrastructure. They do not prove hosted account isolation, production backup recoverability, or live scholarly-provider results.

## Separate application-schema reconciliation

Other historical application tables require a separate dependency and migration-history reconciliation. Do not replay the general migration directory against any hosted target. Preserve existing rows and migration history; stop on a partial schema, unknown version, divergent SQL, signature collision, or unmet dependency.

## Production boundary

No production change is authorized by this package. Any production DDL requires separate explicit owner approval naming the target, exact migration and version, verified backup restore point, and recovery window. Apply only the reviewed migration after isolated staging validation and a fresh read-only preflight. Never use `migration repair` as a substitute for applying DDL, and do not use broad replay to resolve an isolated missing object.
