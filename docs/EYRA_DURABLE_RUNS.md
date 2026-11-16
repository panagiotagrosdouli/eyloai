# EYRA 2030 — Durable run ledger (review branch)

This implements a durable **record of execution** and an at-most-once **reservation boundary** for model-requested actions. It does **not** implement a background job scheduler, automatic resume or guarantee that an external write is atomic with its ledger status.

## Release gate

- `EYRA_DURABLE_RUNS_ENABLED` defaults to **disabled**.
- The migration `20261115233000_eyra_agent_runs.sql` is registered for **disposable local PostgreSQL replay only**; it is **not authorized for hosted Supabase** by the manifest.
- The observed active hosted EYLO database does not have `eyra_conversations`, `eyra_messages` or `eyra_agent_runs` and must not be treated as deployed.
- Enable the flag only after applying the reviewed migration to an isolated staging project, verifying two-user RLS and API behavior under real Supabase Auth and PostgREST, and receiving explicit deployment authorization.
- When enabled and the ledger is absent/unavailable, tool-enabled EYRA requests fail closed; they do not silently fall back to unlogged writes.

## Tables and privacy

- `eyra_agent_runs`: one `(user_id,request_id)` identity, SHA-256 request fingerprint, bounded input preview, status, bounded final text and action summaries.
- `eyra_agent_actions`: unique `(run_id,call_id)`, argument fingerprint, tool name, status and bounded outcome; composite FK enforces matching parent owner.
- Both tables have RLS enabled. Only authenticated SELECT is granted through an `auth.uid() = user_id` policy. Mutations require the server-only Supabase service role **after** validating the bearer user against Supabase Auth; no client INSERT/UPDATE/DELETE grants.
- User deletion cascades run and action records; explicit deletion of a terminal run is available through the authenticated runs API.
- The ledger stores only bounded action metadata (such as a persisted record ID) rather than entire project contents or API secrets. No TTL or silent expiry has been implemented.

## Server lifecycle

1. A tool-enabled browser request gets a UUID before the first fetch. The same UUID survives a 401 token refresh replay.
2. The verified API user reserves quota, then reserves the unique run identity through a conflict-ignoring insert.
3. If `(user_id,request_id)` already exists, inspect the original fingerprint and return HTTP **409**, including `run_id` and status, without any new model/tool execution. A reused UUID for a different request returns `RUN_REQUEST_CONFLICT`.
4. Before each model-requested action, the backend checks for cancellation and inserts a unique `(run_id,call_id)` row. If the insertion was already attempted, the operation is **not replayed**.
5. A successful action is marked `succeeded`. A write with a lost or ambiguous response is marked `needs_review`. Other failures are `failed` or `partial`. Bounded final outcomes are persisted before a 200 response.
6. A process crash or timeout may leave a run `running` or an action `started`. Those are **not permission to retry** a non-idempotent action. Inspect the actual target record and log before any manually approved recovery.

This provides a deterministic single-request idempotency key and action reservations, but **not** global semantic deduplication across independently generated request IDs. It is deliberately conservative under uncertainty.

## Status and cancellation

Possible run states: `running`, `completed`, `failed`, `partial`, `cancelled`, `needs_review`. Action states: `started`, `succeeded`, `failed`, `needs_review`.

`GET /api/eyra-runs?id=<uuid>` returns the caller's run and up to 8 tool actions; list GET returns up to 20 recent run summaries.

`POST /api/eyra-runs` with `{ "id": "<uuid>", "action": "cancel" }` marks only a currently running owner-scoped run `cancelled`. The agent checks before new tools; any *already in-flight* external side effect may still complete. This is **cooperative best-effort** cancellation, not a guarantee of external rollback.

`DELETE /api/eyra-runs` with `{ "id": "<uuid>" }` deletes only a terminal run belonging to the caller; cascade deletes its tool action rows.

The endpoint never accepts a browser-supplied `user_id` or service key.

## Manual stale-run reconciliation

A serverless process crash can leave a run in `running` with one or more actions in `started`. The authenticated Command Center run inspector now exposes **Review stale run (30+ min)**. The owner must explicitly confirm the operation.

`POST /api/eyra-runs` with `{ "id": "<uuid>", "action": "review_stale" }`:

1. Authenticates the current user through Supabase Auth and reads only that user's run.
2. Refuses records that are terminal, malformed, missing or updated within the past 30 minutes.
3. Uses a conditional update scoped to `id`, `user_id`, `running` status and the observed `updated_at` timestamp to change a stale run to `needs_review`. A concurrent update causes a 409 instead of overwriting progress.
4. Marks still-`started` actions `needs_review`, preserving previously confirmed outcomes. This is **not** a claim that the external operation succeeded or failed.
5. Returns `manual_inspection_only`. **No model request, retry, external write, rollback or replay is attempted.**

If updating action records fails after the parent transition, the API reports a partial reconciliation failure and the run remains `needs_review` for operator inspection. The age threshold and conditional update make this less likely to conflict with active work, but cannot prove that a remote side effect is absent. Verify actual workspace records before authorizing any new write.

## Verification

- Node tests exercise run duplicates, ownership, collisions, action uniqueness, terminal-state CAS, unconfirmed writes, and action uncertainty.
- Disposable PostgreSQL tests verify two-user SELECT isolation, the server-only mutation boundary, owner-preserving foreign keys, unique run/action identities and terminal-state compare-and-swap.
- Build, typecheck, lint and existing authenticated product regressions run in GitHub Actions.

## Must still be completed before production

1. Reconcile hosted Supabase migrations against the exact live schema and deploy the canonical conversation migration chain and this additive ledger **to staging first**.
2. Run real staging JWT A/B tests plus service-role tests; verify usage refund accounting, schema grants, failures, repeat submission and cancellation racing an in-flight write.
3. Add per-run progress streaming, structured plan previews, a durable worker/queue for tasks beyond request limits, manual resume/reconciliation tooling and formal retention controls.
4. Require explicit authorization before any merge, remote migration, feature-flag activation or production deployment.

Tracking: [EYRA 2030 issue #462](https://github.com/panagiotagrosdouli/eyloai/issues/462).
