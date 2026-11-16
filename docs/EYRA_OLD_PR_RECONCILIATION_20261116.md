# Reconciling overlapping EYRA draft PRs #475 and #476 — read-only, 2026-11-16

**Do not merge these historical branches wholesale into the EYRA integrated runtime candidate.** The source files and UI versions overlap, and replacing the current UI with the older branch version would remove important later fixes.

## Exact main-vs-branch content comparison

The following blob identities are **identical** between current `main` and draft #475:
- `api/eyra-runs.js`
- `api/eyra.js` (before our new runtime fixes)
- `server/eyra-run-ledger.mjs`
- `src/lib/eyra-run-history.js`
- `src/lib/eyra-conversation-context.mjs`
- `supabase/migrations/20261115233000_eyra_agent_runs.sql`
- `tests/eyra-durable-agent-api.test.mjs`

The following #476 files are **identical** to current main:
- `docs/EYRA_2030_EVIDENCE_RELEASE_GATE.md`
- `src/lib/eyra-conversation.mjs`
- `src/lib/eyra-evidence-status.mjs`
- `src/lib/eyra-quality-metrics.mjs`
- `tests/eyra-evidence-transparency.test.mjs`
- `tests/eyra-quality-metrics.test.mjs`

These facts mean the **source features and their tests are already checked in**, even though GitHub's old draft PRs remain open. Existing source is not a claim of hosted activation.

## Differences that must not regress

- #475's older `EyraCommandCenter.jsx` exposes an `buildVerifiedEvidenceFallback` message calling provider metadata “verified records.” Current main instead uses `buildEvidenceOnlyFallback` and labels retrieved metadata unverified; the current main behavior is more precise and must remain.
- #475's older UI supplies `resource_context` without guarding on `preferences.data_personalization`. Current main checks the preference before forwarding this identifier. Preserve that privacy control.
- #475's source display uses a `ShieldCheck` icon for links, even when source metadata is not independently verified. Current main uses descriptive, safer metadata labels and explicit no-citation notices.
- #476's older UI is missing several later run-history and conversation controls in current main. Replacing the entire component would regress functionality.

## Outstanding real work

1. Confirm the **production** schema still lacks the actual conversation and durable-run tables/RPC, then apply source-reviewed migrations **only** to independently authorized, isolated staging after dependency and history reconciliation.
2. Verify two real authenticated Supabase users cannot read each other's conversations, tool run history, owner-scoped resources or action outcomes.
3. Exercise cancel, timeout, uncertain write, replay and recovery with real provider requests; the checked-in ledger is feature-flagged and not yet hosted-accepted.
4. Review science-quality labels on at least 50 real academic questions against original sources; no model-generated citation is proof of factual support by itself.
5. Review how to close/supersede stale PRs after the current integrated candidate passes hosted acceptance; do not overwrite current-main privacy/evidence fixes.

**Decision:** Source available, hosted/staging acceptance **NO-GO**. This reconciliation performs no migrations, deletes, merges or production deployments.
