# EYRA targeted production repair proposal — 21 November 2026

Target: EYLO Supabase `kbzjngpzxpniaumlupaa` only. **Not authorized or applied.**

## Observed problem

Read-only live catalog checks confirm missing `eyra_conversations`, `eyra_messages`, `eyra_agent_runs`, `eyra_agent_actions`. Prior metadata preflight also found the snapshot RPC absent. This blocks persistent conversation history and the durable action ledger. The deployed source is main `5eb1c1da`; the design PR is now deployed. AI capability being true proves configuration only, not a successful authenticated model request.

## Exact candidate scope

Apply only these reviewed source files in dependency order, with SHA-256 fingerprints in `../integration/eyra-targeted-change-plan-2026-11-21.json`:

1. `20261113090000_eyra_conversations.sql`: private conversations/messages, composite owner foreign key, version guard, owner RLS and explicit grants.
2. `20261113114924_eyra_conversation_snapshots.sql`: transactional snapshot RPC.
3. `20261113120556_eyra_snapshot_retry_identity.sql`: replace the preceding two-argument RPC with the idempotent three-argument, SECURITY INVOKER RPC. Its DROP targets only the function just introduced by step 2.
4. `20261115233000_eyra_agent_runs.sql`: owner-readable execution ledger with service-only writes and owner-bound action foreign key.

No bulk migration push, unrelated schema repair, history renaming/repair, existing customer-record edits, Auth account creation or service provisioning is included. Historical migration mismatch remains a separate issue.

## Required execution gates

Before any production change: explicit owner authorization of this scope, current backup/recovery verification, recheck table/function absence, exact source fingerprints and dependency availability. Review current official Supabase guidance, logs and advisors. If objects already exist or any condition differs, stop; never drop existing objects to force replay.

Preferred acceptance is an isolated staging Supabase project with two real test accounts. A branch could not previously be created because the account requires Pro. No staging identity or usable signed-in test session is currently available. Local PostgreSQL testing does not establish hosted Auth/Storage behavior. This limitation must be resolved or explicitly reviewed before production execution.

Use a bounded transactional application strategy with lock/statement timeouts and migration registry entries matching the exact approved SQL. Recheck RLS, grants, snapshot signature and advisors after application. Any failed step must leave no partial schema. Before newly created tables receive user records, rollback can remove only new objects in reverse dependency order; after writes begin, retain/export new records and use a forward repair rather than destructive rollback. Restoring the prior frontend alone does not undo database changes.

## Acceptance

Real accounts A/B: save/reload a conversation, retry the same snapshot ID without duplication, deny B access to A records and cross-owner writes, verify ordered messages, user deletion/cascade behavior in staging, owner-only ledger reads and service-only writes. Then exercise an authenticated real EYRA provider response, citations and explicit action opt-in. Never insert simulated replies to satisfy acceptance.

## Current verification and remaining scope

The full disposable PostgreSQL runner passed, including EYRA owner RLS, snapshots, constraints, ledger, two-session conflict and quota tests; it uses synthetic Auth identities and is not hosted acceptance. Public live GET probes verify the exact deployed commit and real OpenAlex results. Six scholarly provider routes returned records; Semantic Scholar returned upstream 429. Contact/billing/scheduled monitoring/institution analytics are reported unconfigured by the live capabilities endpoint. Public RLS is enabled on all 34 observed tables; this alone does not establish correct per-user isolation.

Security advisor: leaked-password protection disabled ([Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). The server-only rate-limit table intentionally has no client RLS policies; do not grant client access simply to suppress an informational notice.

No production writes, account creation, secret extraction, payment, deployment or infrastructure purchase was performed in this review. The product is not certified fully functional.
