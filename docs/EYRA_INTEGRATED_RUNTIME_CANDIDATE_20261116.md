# EYRA integrated runtime candidate — 2026-11-16

This branch combines the **source-code-only** fixes from draft PRs #491, #492, #493 and #494, on top of the exact `main` commit `9875795514db8c8705aac973e696ffa1e7d0efee`. It is a **review and CI candidate, not a deployable EYRA launch approval**.

## Integrated behavior

| Area | Scope | Evidence |
| --- | --- | --- |
| Provider tool calling | OpenAI-compatible function names (underscores) at the API boundary, canonical dotted internal permission/history names; no implicit write grants | `tests/eyra-provider-tool-contract.test.mjs` |
| Subscription integrity | Reuses staging-only billing activation rather than treating live Stripe credentials as proof of paid EYRA entitlement | `tests/eyra-entitlement-quota-integrity.test.mjs` |
| Quota faults | Invalid, missing or duplicate quota responses do not request AI or falsely claim user plan exhaustion | Same API regression suite |
| Cloud conversations | Cloud save and open buttons enable only after successful owner-scoped history load; error, export and retry remain available | `tests/eyra-cloud-history-availability.test.mjs` |
| Cancellation | Propagates AbortSignal through public research and funding provider transports; stop clears write consent | `tests/eyra-retrieval-cancellation.test.mjs` |
| Write consent | English/Greek explicit imperative writes only, no bare 'my library' authorization; separate clause denials | `tests/eyra-write-intent-safety.test.mjs` |
| Streaming quota | After the client receives a partial token stream and closes, prevent free quota replay; preserve provider-failure refunds | `tests/eyra-stream-api.test.mjs` |

## Scope and exclusions

- All user/project database operations remain bound to existing verified Auth and RLS paths; no migrations applied, no new secrets accessed and no actual OpenAI/Stripe calls made in this integration.
- **NOT included:** unmerged #475 conversation-run ledger migration or #476 evidence/consent quality features. Both touch overlapping EYRA UI and require separate careful review before any integration into this branch.
- **NOT hosted-accepted:** conversation snapshot tables/RPC, run ledger, two-account isolation, voice, actual provider request formats, live quota/refund, scientific reviewer audit, accessibility, Vercel preview and rollback.
- Active EYLO production schema still lacks `eyra_conversations`, `eyra_messages`, `eyra_agent_runs`, `eyra_agent_actions`; source feature flags cannot replace tables or hosted acceptance.
- A READY Vercel deployment or a green GitHub Actions suite cannot alone establish that provider calls work with real keys. Vercel account's preview build-rate limit may independently block preview generation.

## Review checklist

1. Exact head SHA of this integration branch must pass full quality, build and Product Quality CI including added regression suites.
2. Review the diff for overlapping code and run static typecheck/lint; ensure no broad OAuth/Stripe/RLS migration snuck in.
3. Obtain a distinct owner-authorized Supabase staging project and disposable two-user Auth identities; reconcile and apply *source-reviewed* conversation/agent migrations only there.
4. Test live OpenAI Responses with real provider-valid tools, canceled streams, failure/retry, structured output and source-linked research; measure real usage quota effects.
5. Test actual UI cloud save/rename/export/delete, native/unsupported voice behavior, mobile accessibility and owner isolation. Integrate #475/#476 only after dedicated review.
6. Record sanitized acceptance evidence tied to exact deployed commit, reviewer and rollback; **do not merge or deploy to production without explicit release approval**.

**Decision:** NO-GO for full EYRA launch; SOURCE IMPLEMENTED / automated-test candidate only.
