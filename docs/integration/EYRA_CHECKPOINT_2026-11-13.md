# EYRA integration checkpoint — 2026-11-13

## Branch and provenance

- Existing draft PR: https://github.com/panagiotagrosdouli/eyloai/pull/398
- Branch: `codex/eylo-platform-integration-audit`
- Verified starting HEAD: `604e629caa6d84faeeaa972866e6d5220650d2a2`
- The checked-in evidence at that HEAD reports 531 tests, not the later-reported 544. The later Time Tracker / Quiz / Learn work was not verified at this HEAD. Do not assume it was committed.
- This is a bounded EYRA reliability slice, not a completed assistant or provider acceptance.

## Changes committed in this slice

1. `dc4ba42b369e99e3d25221266ce68126d0df82eb`: bound initial and tool-follow-up Responses requests to 4096 output tokens; surface a distinct missing OpenAI key state; distinguish provider HTTP 429 and 401/403 without exposing upstream error bodies. Existing monthly usage reservation remains in place.
2. `7e75306c7dd0667822eab3bc67e935dcd46c89a3`: add mocked-provider regression tests for successful bounded output, HTTP 429 usage refund, and missing credentials without quota reservation.

These tests use disposable values and mocked HTTPS responses; they do not call OpenAI or Supabase.

## Verification boundary

- New focused tests and broader GitHub CI: check workflow results for the latest PR head. Do **not** treat new checks as passed unless a completed run reports success.
- BLOCKED — LIVE OPENAI INTEGRATION NOT VERIFIED. No authorized live OpenAI request was executed.
- Hosted Supabase Auth, conversation RLS/persistence, true streamed responses, cancellation during generation, full token accounting, and request-rate limiting remain unverified or not implemented.
- Current `api/eyra.js` uses non-streaming Responses JSON. The new 4096-token ceiling is not streaming or total per-user token metering.
- Existing Ideas records were not repurposed as conversations. No new database schema was introduced.
- No production deployment, remote migration, payment, or production data write was performed.

## Safe owner-side configuration (separate authorized environment)

1. Create or select a separate non-production deployment and verify its exact project identity; never use the existing live EYLO Supabase project as staging.
2. Set `OPENAI_API_KEY` as a server-side secret in the deployment environment. Do **not** use the `VITE_` prefix, commit the value, or put it in browser code.
3. Optionally set server-side `OPENAI_MODEL` to a Responses-compatible model authorized for that account. Review spending limits and model access.
4. Configure the deployment's existing Supabase URL, publishable key, and server-side service credential through its approved secret manager; verify that the `reserve_eyra_usage` and `release_eyra_usage` RPCs exist in the separately authorized staging schema.
5. Validate authenticated calls with disposable staging users and known read-only scenarios; verify provider errors and quota behavior before enabling write tools. Capture sanitized logs and request IDs, not secrets or private prompts.
6. Treat streamed delivery, cancellation, two-user conversation isolation, retention and write-action confirmations as release blockers until separately implemented and tested.

## Next smallest task

Build and test a read-only, owner-scoped EYRA conversation listing/loading interface against an explicitly approved canonical persistence contract. Before selecting Ideas, examine actual Ideas RLS, retention and record semantics. Do not create a parallel table merely to unblock this task. Keep the PR draft.


## 2026-11-13 follow-up — conversation retrieval contract review

Starting HEAD verified: `7b78ba63948254c930d4664ef7cf2347267aeaad`. Scope limited to EYRA read-only conversation listing/loading.

**Decision: BLOCKED — NO APPROVED SERVER-SIDE CONVERSATION PERSISTENCE CONTRACT.** No functional conversation listing/loading API was introduced; returning Ideas or searches under a conversation label would be unsafe and misleading. No production or staging write was performed.

Source findings:
- `supabase/migrations/20260803_eylo_core_entities.sql` creates `ideas`, `search_history`, `projects` and other distinct owner-scoped generic entities. The policy `Users manage own rows` restricts authenticated access by `auth.uid() = user_id`. The migration provides an updated timestamp but no conversation versioning, retention TTL or message schema.
- `src/pages/IdeaVault.jsx` expects Idea rows to represent editable research/startup ideas, with categories/tags, user deletion, research-watchlist creation and `eyra_notes` from idea analysis. Reusing Idea rows as hidden conversations would risk leaking chat records into the Idea Vault, destructive cross-product UX, and incompatible retention semantics.
- `src/components/eyra/EyraCommandCenter.jsx` saves the last 30 messages to `sessionStorage['eyra_command_conversation_v2']`. This is browser session state, not a durable authenticated conversation database; it cannot support server-side User A/User B isolation guarantees.
- `src/services/supabase-entities.js` has owner-filtered entity reads but no approved `Conversation` entity. Existing `search_history` is not a threaded conversation contract.

Commit `e0605ade435494b9b31c570fe823b0fbb76ecc38` adds three focused regression guards for Idea semantics, browser session-only history and owner filters. These are **contract tests**, not tests of a nonexistent conversation listing API. User A/User B conversation cross-read, invalid/missing conversation IDs and unauthenticated conversation endpoint tests remain **NOT RUN / NOT IMPLEMENTED**. Existing local PostgreSQL owner-policy evidence is about existing entities, not conversations. Hosted Supabase is **NOT VERIFIED**.

Next smallest task: explicitly approve a durable owner-scoped conversation persistence contract with message schema, ID semantics, versioning, retention, deletion and RLS acceptance criteria, without repurposing Ideas. Then implement read-only GET list and by-ID handlers with authenticated Supabase bearer and explicit user-id filtering, 400 invalid ID, 401 unauthenticated, and indistinguishable 404 for missing/foreign IDs; run mocked API tests and disposable PostgreSQL two-user policy tests. Keep PR Draft; do not migrate staging until separately authorized.


## 2026-11-13 EYRA durable conversation foundation

Verified starting HEAD: `aee9f370aa6a4fe1eb25dbd5ae308f8f9ec280ed`. Existing PR #398 remains Draft. No data migration has been applied to a hosted Supabase project.

### Persistence contract (repository proposal; not deployed)

- `supabase/migrations/20261113090000_eyra_conversations.sql` adds **only** `eyra_conversations` and `eyra_messages`, neither of which reuses Ideas or `search_history`.
- Conversation: UUID, auth user UUID, title 1–180 characters, UTC created/updated timestamps, version starting at 1. Database trigger prohibits reassignment of id/owner/created time and advances version for optimistic compare-and-set updates.
- Message: UUID, conversation UUID + owner UUID composite foreign key, unique positive sequence number (1–100000), role user/assistant/tool, JSONB exactly `{"text":"..."}` (1–16000 text characters, bounded byte size), and created timestamp. Append-only owner inserts; cascade deletion by parent. Unexpected provider metadata is forbidden by the content check.
- Both tables use owner-only authenticated RLS for reads/inserts, with owner-only conversation update/delete. Only authenticated role grants are provided; service_role/public/anon grants are revoked for these tables. API endpoints use the public Supabase key + verified user bearer, **never** the service-role secret. Note: administrative credentials with PostgreSQL BYPASSRLS privileges must remain restricted to owner-approved server infrastructure.
- Retention: no automatic TTL, purge job, archive, or silent expiry. Conversation persists until explicit owner deletion or auth-user deletion; dependent messages cascade. Account deletion is controlled by the existing auth relationship.
- Versioned write endpoint, message append endpoint, deletion UI, quotas, moderation, encryption-at-rest review and retention-policy acceptance remain **not implemented** in this read-only slice. Database grants enable owner-writes for future reviewed functionality; the new HTTP endpoint is GET-only.

### Read-only API

`GET /api/eyra-conversations` lists caller-owned conversations; `GET /api/eyra-conversations?id=<uuid>` loads caller-owned conversation and a bounded message page. `page` (default 1, max 100), `limit` (default 20 for threads / 100 for messages, max 50 / 100) and stable sort (threads `updated_date desc,id desc`, messages `sequence_number asc,id asc`) are enforced. 401 missing/invalid bearer, 400 malformed ID/page/limit, and identical 404 for foreign and missing UUIDs. Responses are marked private/no-store. No write request and no OpenAI request are made.

### Test scope and evidence boundary

- `tests/eyra-conversation-api.test.mjs` mocks Auth/PostgREST: two-user listing, foreign/missing 404 equivalence, valid load, pagination, bad IDs, missing/invalid authentication, no service-role key and no unrelated Ideas/project access.
- `tests/integration/eyra-conversations-postgres.sql` extends the disposable PostgreSQL fixture after existing workspace checks: actual SQL policies for two synthetic users, cross-owner insert/update/delete rejection, uniqueness and content limits, CAS version behavior, cascade deletion and Idea/project compatibility.
- `scripts/integration/test-local-postgres.py` applies the new migration and executes the SQL fixture in the same isolated Docker container, with `--network none` and no published ports. The EYLO Quality Gate CI workflow now runs this local PostgreSQL test in its runner. CI status and result must be confirmed at the final HEAD before claiming SQL PASS.
- This does not test hosted Supabase Auth, hosted PostgREST, deployment state, browser UI integration, live OpenAI, or verified staging credentials. **BLOCKED — LIVE OPENAI INTEGRATION NOT VERIFIED.**
- No production deployment, remote migrations, live payments or production user data changes.

### Next smallest task

After authorized separate staging becomes available, apply the reviewed migration to staging, exercise authenticated read-only list/load with two disposable accounts, and verify hosted PostgreSQL RLS and deletion. Until then, keep the PR in Draft and deployment blocked.
