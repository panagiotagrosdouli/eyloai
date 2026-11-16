# EYRA 2030 — Integrated production safety checkpoint

This is a reviewable integration of the durable run work in #475 and the evidence/privacy work in #476, on the current `main`. It is **not** an authorization to migrate the connected Supabase database, enable agent writes, or release to production.

## What is implemented together

- Canonical `/api/eyra` owner authorization and latest-user-turn write-intent checks remain in force.
- `EYRA_DURABLE_RUNS_ENABLED` continues to default **off**. The proposed server-owned run ledger reserves a per-user request UUID and per-run tool call before side effects when explicitly enabled after staging validation. A duplicate returns an error instead of executing again.
- A compact Agent runs panel can inspect limited run metadata, request cooperative cancellation and remove terminal history, subject to server owner checks.
- User-request review and `write_confirmed` are required for existing project/paper actions; **exact generated-field previews are still not available**.
- Academic source cards distinguish a retrieved bibliographic record from verified claim-level scientific evidence; no citation ID or URL implies full-text review.
- Failed retrieval/synthesis uses the current evidence-only fallback. A no-citation warning survives conversation normalization and context personalization opt-out prevents automatic project context handoff.
- Offline quality metrics count independently human-coded claim-support labels separately from citation-ID integrity, with explicit denominators.

## Main architecture boundaries

The new ledger tables are registered for **disposable local PostgreSQL replay only** in the migration review manifest. The hosted EYLO database was previously observed without the conversation and ledger tables; schema presence must be re-verified with read-only inspection at deployment time.

Do not enable `EYRA_DURABLE_RUNS_ENABLED` before approved staging execution of the canonical conversation migrations and additive ledger migration. Enforce owner-scoped real JWT A/B checks, service-role-only mutations, usage reservations, lost-response-after-write, cancellation and duplicate requests under concurrency. Ambiguous writes require manual review; there is no automatic retry/resume of a potentially committed write.

## Required release checks

1. Build, EYLO Quality Gate, Product quality on **the exact integration head commit**.
2. Staging migration plan signed off by the database owner; real Supabase RLS checks with two separately authenticated test users.
3. Vercel preview `READY` for the same SHA; mobile, keyboard, authenticated chat and source-link smoke checks.
4. Independent assessment of citation **claim support** rather than only link/identifier correctness; include deliberately insufficient-evidence cases.
5. Security review of any service-role endpoint; exact pending-field review UI and approved write retention policy before expanding agent actions.
6. Explicit maintainer review, reconciliation of #475/#476 and normal protected branch merge/release gate.

**No direct production migration, flag activation or deployment is performed by this PR.**
