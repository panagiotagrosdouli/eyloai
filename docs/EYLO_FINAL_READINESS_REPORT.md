# EYLO Final Readiness Report

Assessment date: 2026-11-22 (Europe/Athens)
Reviewed commit: `c7b331454d54ca72486a799994c13ca7cbec4aeb`
Production alias: `https://eyloai.vercel.app`
Decision: **NO-GO — not ready for production launch or researcher pilot**

This report separates code/test evidence from hosted acceptance, scientific evaluation, and commercial validation. It records the current read-only checks and the repository's latest execution evidence. It does not certify the application.

## Technical architecture

The repository describes a React 18/Vite application with React Router, Supabase authentication/PostgreSQL/RLS/Storage, Vercel serverless functions for EYRA and supporting APIs, and Stripe Checkout/webhook foundations. GitHub Actions include build and product-quality workflows. The product inventory contains 77 product surfaces; route and source-action mapping is maintained in the [functional audit](FULL_SITE_FUNCTIONAL_AUDIT.md).

## Functional coverage

- **Public discovery:** HOSTED VERIFIED for one live OpenAlex query returning a real scholarly record. This does not verify all providers, relevance, de-duplication, author/institution searches, pagination or outage recovery.
- **Production deployment:** HOSTED VERIFIED for provenance: the Vercel production alias serves commit `c7b331454d54ca72486a799994c13ca7cbec4aeb`, matching `/release.json`; the deployment is READY.
- **Private research workflows:** UNVERIFIED on hosted accounts. Library, Projects and Files have repository implementation and prior synthetic browser coverage, but no current two-account staging acceptance was observed.
- **EYRA:** BLOCKED. The deployed capability reports `ai=true`, which does not certify a real model response. Production schema inventory lacks conversations, messages, agent runs and agent actions. Real response, citation provenance, persistence and approved actions are unverified.
- **Grant/team/meeting modules:** BLOCKED by absent production tables documented in the tracker. No bulk historical migrations were applied.
- **Billing/contact/monitoring/institution analytics:** UNAVAILABLE; public capabilities report all four false. Do not advertise these as working.

## Test evidence

Repository documentation records that 1,220 Node tests, import checks, API/frontend typechecks, lint and production build passed on release candidate `1b2fcebc331c825a20458cda7be2a7ba7464bf02`, along with synthetic-transport Auth, product and Learning browser suites and disposable PostgreSQL integration.

GitHub Actions on PR #595 head `179eb8a05e041ef1f75c3cbe8afd2e35886954d5` passed `Build`, `EYLO Quality Gate`, `Product quality`, and `EYRA schema preflight (disposable PostgreSQL)`. Product quality passed production build, typecheck, lint, core regression tests, EYRA terminal stream, Auth, Library, Learning, all 22 product workflows, public landing, gateway error attribution, local-time greeting, partial-source resilience, secure service credentials and deterministic relevance benchmark. The disposable PostgreSQL replay included the 13 exact FK-index assertions. The Vercel preview for that head reached READY. PRs #593 and #594 also retain passing CI and READY previews. Repository checks ran against the actual PR source because no local checkout was mounted. Synthetic fixtures and disposable databases do not establish live provider, Auth, RLS, Storage or customer acceptance.

Live GET checks on 2026-11-22 returned 200 for `/release.json`, `/api/capabilities` and a single scholarly discovery query. Vercel error/fatal log grouping for the production deployment over the latest 30 minutes returned no groups; traffic coverage is unknown. The release probe is still `PROBE_FAILED` for commercial readiness because contact and billing are not configured.

## Scientific quality

**NOT SCIENTIFICALLY EVALUATED.** A live OpenAlex response confirms one provider route returned a record. There is no current human-judged relevance result in this execution. The repository's previous evidence notes that heuristic retrieval checks are not a human relevance study. Require domain- and intent-stratified Precision@5, Precision@10 and nDCG@10 from blinded judgments before claiming evaluated retrieval quality. EYRA accuracy and citation support have not been scientifically reviewed.

## Security status

**OPEN — no security certification.**

- The Supabase security advisor reports leaked-password protection disabled (WARN).
- It reports RLS enabled without policies on `public.discovery_rate_limits` (INFO). This is fail-closed, but the expected server-side access path should be confirmed before changing it.
- Two-account RLS/Storage acceptance is outstanding; no user-isolation claim is made.
- Supabase performance advisor reports 13 unindexed foreign keys. PR #595 proposes additive indexes; its exact catalog assertions passed in disposable PostgreSQL, but the hosted migration has not been applied or rechecked.
- No production secrets were read or printed.

## Database and privacy status

Supabase project `kbzjngpzxpniaumlupaa` reports `ACTIVE_HEALTHY`. Read-only catalog inspection confirms several core tables, including Projects, Files and File Versions, but also confirms absent EYRA, grant-application, team/community/directory/API-token, and meeting-participant tables. The migration registry lists 19 migrations through `20261115194359`. The only listed Supabase development branch reports `MIGRATIONS_FAILED` although its preview project status is `ACTIVE_HEALTHY`; it is not accepted as a healthy staging environment. No reset or migration operation was performed.

A current verified production backup/recovery point is **not evidenced in the connected tools**. Production schema changes remain blocked until recovery evidence is verified. Privacy controls, account deletion/export behavior and jurisdiction-specific legal review are not certified.

## Billing and operations

Billing, contact/support delivery, scheduled monitoring and institution analytics are currently reported unavailable. No live charge, webhook acceptance, real support delivery, scheduled run or external institution analytics workflow was performed. Operational recovery and incident-response readiness remain unverified.

## Business validation

**NOT VALIDATED.** This review found no verified customer, revenue, partnership, pricing, or pilot evidence. Do not represent these as established.

## Release blockers

1. Verify a current production recovery point for the correct Supabase project.
2. Resolve and verify the targeted EYRA schema and hosted persistence flow after that gate.
3. Diagnose the existing Supabase development branch migration failure without resetting it, then complete two-account acceptance on a healthy isolated staging environment for authentication, RLS, Library, Projects, Files, EYRA and feature-specific modules.
4. Review Auth leaked-password protection and verify intended server-only access for discovery rate-limit records.
5. Complete provider, source-quality, citation and human-judged relevance evaluation.
6. Keep billing and contact disabled until their test-mode and real-delivery acceptance passes.
7. Complete privacy/legal, support, operations and mobile/accessibility review.

## Final recommendation

**NO-GO.** Production deployment identity and a narrow public discovery smoke check pass. Core private-account acceptance, EYRA persistence, scientific quality, recovery, billing/contact, and business/legal readiness remain open. Do not claim the platform is fully functional, scientifically validated, secure, compliant, or launch-ready.

The execution and business-foundation work is recorded in open PRs #593 and #594; the FK-index source change is in open PR #595. None is merged. See the [execution tracker](EYLO_AUTONOMOUS_EXECUTION_TRACKER.md) for the feature inventory and exact next engineering action.