# EYRA release-readiness checkpoint — 2026-11-16

**Decision: NO-GO for declaring the complete EYRA production-ready.** This checkpoint describes verified source and infrastructure facts, not a provider-success report.

## Confirmed current implementation

- `api/eyra.js` has authenticated server-side OpenAI Responses requests, free-plan quotas enforced through service-role-backed RPC, structured output, streaming and a bounded tool allowlist.
- Verified on the **actual EYLO production Supabase project** by read-only metadata: `reserve_eyra_usage` and `release_eyra_usage` routines exist.
- Verified on the connected Vercel project by querying **environment variable names only, not values**: production configuration contains `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. This proves neither token validity nor successful requests to OpenAI.
- The active production database does **not** contain `eyra_conversations`, `eyra_messages`, `eyra_agent_runs` or `eyra_agent_actions`. `save_eyra_conversation_snapshot` was also absent from the routine inventory. Therefore server-backed conversation memory and durable action history are **not hosted-accepted**.
- PRs #475 (durable agent runs and memory) and #476 (evidence transparency and research quality) are still open and overlap with EYRA code. Review and integrate them with current `main`, not by blindly merging historical changes.
- No separately authorized staging Supabase project with two disposable users was identified during the previous read-only audit. No provider test calls, paid charges, schema writes, migrations or production deployments were performed for this checkpoint.

## This incremental fix

1. EYRA now uses `isBillingTestEnabled()` just like `/api/billing`. A live Stripe key accidentally present in production cannot cause EYRA to read or trust an unapproved paid entitlement or remove the free usage cap.
2. Corrupt, missing, duplicated or nonnumeric quota reservation results fail closed with HTTP 503 `USAGE_CONTROLS_UNAVAILABLE`, **before** an OpenAI provider request. Valid quota exhaustion remains HTTP 429 `PLAN_LIMIT_REACHED`.
3. Negative tests verify 503 on invalid quota records, correct 429 for genuine exhaustion, no unmetered provider call and staging-only paid-plan behavior. Fixtures are not real provider acceptance.

## Required acceptance before launch

| Area | Acceptance required | Status |
| --- | --- | --- |
| Auth | Two disposable accounts, login/recovery, actual protected EYRA responses and no cross-account reads | NOT_RUN |
| Provider | Actual OpenAI test prompts in approved staging; bounded errors, timeouts, cancellation and stream completion | NOT_RUN |
| Usage | Real Supabase reserve/release RPC across quota boundary and transport failures, without double charging | NOT_RUN |
| Conversations | Review/apply existing canonical conversation migrations in isolated staging; save, reload, rename, export, delete, and owner isolation | BLOCKED: live tables absent |
| Durable tools | Review #475 ledger migration and exact-once/uncertain-write behavior; no automatic replay of writes | BLOCKED: live tables absent |
| Research | Verify Crossref DOI metadata, citation IDs and genuine claim support against primary source text | NOT_RUN |
| Consent | Confirm exact, user-approved write intention and a field-level pending-write preview before executing model-proposed writes | PARTIAL: preview missing |
| EYRA UI | Desktop/mobile/keyboard/voice fallback; source warning, disabled history, request cancellation and recoverable errors | PARTIAL |
| Voice | Browser microphone behavior, permissions and any LiveKit two-party features on supported devices | NOT_RUN |
| Privacy | Two-user RLS, private context, token handling, transcript retention/deletion and no private data in logs | NOT_RUN |
| Scientific quality | At least 50 diverse independently evaluated questions with claim-support and citation precision, zero unauthorized/duplicate writes | NOT_RUN |
| Operations | Exact-SHA CI + preview, verified env/DB identities, alarms, limits, accessibility, backup/restore, security + owner review | NOT_RUN |

## Safe staged rollout path

1. Obtain **owner-confirmed separate staging** Supabase ref and matching Vercel preview (never run writes against `kbzjngpzxpniaumlupaa` or unrelated project `umzrggayitzfgrrofjnw`).
2. Compare live migration history and schema to current source, then test the existing conversation migration chain and #475 run ledger on disposable staging. Inspect ownership grants, RPC rights, Auth, Storage, rollback and RLS using two distinct users.
3. Exercise end-to-end authenticated model usage and quota, source lookups, supported tool reads, explicit write confirmation, cancellation and no duplicate writes after retry. Verify streaming and structured outputs on real provider responses.
4. Finish review/integration of #475 and #476 and quality measurement; accept each EYRA feature independently, including accessibility and error states.
5. Record exact staging deployment SHA, sanitized evidence, owner review and failure cases. A green CI build or present environment key is not release authorization.
6. Only after separate explicit owner approval can any production migration or EYRA feature activation be planned. No such approval is implied by this documentation.

**This PR is a narrow source fix, not an end-to-end production release claim.**
