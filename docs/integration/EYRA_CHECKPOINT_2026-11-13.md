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
