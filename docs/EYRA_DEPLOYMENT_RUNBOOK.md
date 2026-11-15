# EYRA deployment runbook

## Required configuration

- `VITE_SUPABASE_URL`: explicit HTTPS Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` (or supported anon-key alias): public key for the configured project.
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: required by existing EYRA usage reservation and quota RPC path; never send this key to the browser.
- `OPENAI_API_KEY`: server-only Responses API key.
- Optional `OPENAI_MODEL`; otherwise the existing default is used.
- Stripe secrets and price IDs are required for billing entitlement enforcement; without complete billing configuration, the existing code treats EYRA as free tier.

## Before deploying

1. Review the focused branch and confirm it targets the intended repository and `main`.
2. Run `npm run check:imports`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
3. Deploy a preview and test with a disposable authenticated user: list projects, create one with an explicit request, verify its UUID and row, then confirm a second user cannot read it.
4. Ask EYRA to save a retrieved DOI paper. Verify the title against Crossref and confirm the record appears once in the same user's Library.
5. Verify billing configuration and the free-plan project limit against the intended Supabase project.
6. Confirm production URL, deployed commit, and authenticated endpoint behavior before communicating availability.

## Recovery

If OpenAI fails before a tool call, no project operation should have run. If a Supabase write succeeded but the OpenAI follow-up fails, the database row is authoritative; query it through the authenticated project view before retrying to avoid duplicates. The current implementation does not provide durable idempotency keys or a separate action-history screen.

## Live database audit — 2026-11-15 (read-only)

A connected Supabase project named `eyloai` reported status `ACTIVE_HEALTHY`, but its `public` schema table listing did **not** include `eyra_conversations` or `eyra_messages`. The live migration history also did not list the EYRA conversation migration sequence:

1. `20261113090000_eyra_conversations.sql`
2. `20261113114924_eyra_conversation_snapshots.sql`
3. `20261113120556_eyra_snapshot_retry_identity.sql`

Therefore durable EYRA conversation persistence is **not verified and must not be advertised as active** for this project. Review the migration dependency chain and run the existing SQL integration tests against an approved staging database **before** planning deployment. Do not apply these migrations to production as a side effect of reviewing this PR.

The same read-only security advisor check flagged leaked-password protection disabled (WARN). It also reported `public.discovery_rate_limits` with RLS enabled and no policies (INFO); because this may be intended as a service-only table, verify its access model before adding a policy. These warnings are not evidence of an exploitable EYRA vulnerability without additional testing.

After the staging migrations, verify the canonical owner-only conversation reads and writes using two separate authenticated users, validate the snapshot RPC retry behavior, and verify quota/cancellation/streaming against real endpoints. Record outcomes and migration versions before releasing.

## EYRA 2030 durable ledger and conversation memory — pending staging

The branch `feat/eyra-2030-durable-runs-and-memory-20261115` adds:

- `supabase/migrations/20261115233000_eyra_agent_runs.sql` for owner-scoped, read-only-to-clients agent run and action logs
- `server/eyra-run-ledger.mjs` for server-side run and action deduplication with fail-closed uncertainty
- `api/eyra-runs.js` for authenticated list, details, cooperative cancellation and explicit deletion
- bounded recent-conversation context and owner/version-scoped saved-conversation renaming

**The migration manifest remains local-disposable-only and `EYRA_DURABLE_RUNS_ENABLED` must stay unset/false in production.** This is not permission to migrate or enable. A real live schema check still showed no `eyra_conversations`, `eyra_messages`, `eyra_agent_runs` or `eyra_agent_actions` tables in the active hosted EYLO Supabase. This should be re-verified immediately before staging work.

Staging acceptance order:

1. Verify schema/history of an isolated staging project and inspect existing tables, policies, grants, foreign keys, and auth setup; do not blindly replay core historical migrations.
2. Apply the canonical conversation chain in order: `20261113090000_eyra_conversations.sql`, `20261113114924_eyra_conversation_snapshots.sql`, `20261113120556_eyra_snapshot_retry_identity.sql`. Confirm each dependency before applying the next.
3. Apply the additive agent ledger migration and verify RLS for two genuinely different JWT users, direct-client mutation denials, server-only writes, duplicate `(user_id, request_id)`, duplicate `(run_id,call_id)` and cascade deletion. Repeat all of this with actual PostgREST and Supabase Auth.
4. Exercise artificial provider timeouts and transport-loss-after-write. Confirm the same run UUID returns 409 on a retry and does **not** run the side effect again; inspect `needs_review` and `partial` outcomes.
5. Test user cancellation during tool execution and explicit terminal-run deletion. Cancellation is cooperative: it cannot revoke an external write already running.
6. Verify quota refund behavior, usage caps, privacy and performance; then separately approve the feature flag and any deployment.

Do not claim persistent memory or the new durable ledger are hosted until these checks and explicit release approvals are complete.
