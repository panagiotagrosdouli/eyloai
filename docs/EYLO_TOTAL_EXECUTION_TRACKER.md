# EYLO total execution tracker

**Updated:** 25 November 2026 (Europe/Athens)

**Repository baseline:** `10a660585d74e9140c4f8345af21d6d88ff02439` (current `main`)

**Working branch:** follow-up to PR [#604](https://github.com/panagiotagrosdouli/eyloai/pull/604), `codex/internal-eyra-20261124`

This file is the current execution index. It does not promote a feature to staging or production verified. The canonical feature-by-feature inventory is [PRODUCT_IMPLEMENTATION_TRACKER.md](PRODUCT_IMPLEMENTATION_TRACKER.md): it contains 77 individually numbered existing product modules, their implementation descriptions, tests and remaining acceptance. All 77 are currently marked **PARTIAL**. The route-level inventory and audit is [FULL_SITE_FUNCTIONAL_AUDIT.md](FULL_SITE_FUNCTIONAL_AUDIT.md). Preserve those detailed inventories rather than maintaining a second, divergent copy here.

## 25 November execution update

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Current production source | READY deployment metadata | Vercel lists production deployment `dpl_4BUS52NAYLoWR5gpm77N9yX8JydX` for main SHA `10a660585d74e9140c4f8345af21d6d88ff02439`. This verifies the recorded deployment state and source identity, not private workflows. |
| GitHub Actions on main | PASS | The current Product quality run and GitHub Pages deploy run for `10a660585d74e9140c4f8345af21d6d88ff02439` both completed successfully. |
| EYRA action outcome and restore tests | PASS | Added regression coverage for UUID write receipts, unconfirmed outcomes, upstream error redaction, and clearing while a cloud-history restore is pending. Four focused tests and the complete local `npm run check` passed. The first exact-head hosted run exposed an obsolete test expectation for an HTTP response after the request had been canceled; the test now asserts cancellation. Exact application head `04b059ef7761c9d4f6f7af23f0737fa761595b62` passed `build`, `imports`, `verify`, and `build-and-benchmark`; Supabase Preview was skipped. |
| Supabase migration preview | BLOCKED | The connected `eyloai` project is active and healthy. Its only listed development branch, `main`, currently reports `MIGRATIONS_FAILED`; no migration was applied or retried. |
| Supabase security advisor | ACTION REQUIRED | Leaked-password protection is disabled. A Supabase administrator must enable it and recheck Auth. `public.discovery_rate_limits` has RLS enabled with no policies; this is an informational finding and denies row access through ordinary user roles. |
| Release readiness | NO-GO | `npm run release:readiness` correctly rejects the available ledger because current-commit CI and the required hosted staging, two-account, research-quality, privacy, UX, operations and owner-review evidence are absent or stale. |

The hosted Supabase findings are read-only observations. Do not treat the existing migration preview as an authorized staging database, and do not apply migrations, alter Auth settings, or use live accounts to fill the missing gates.

## Current release decision

**NO-GO for commercial launch, private external pilots, live billing, or production schema changes.** The Vercel production deployment is READY and its source SHA matches the repository baseline, but a public read-only smoke request to scholarly discovery returned HTTP 429. Contact and billing are disabled. Staging identity, hosted two-account acceptance, migration-history reconciliation, and owner/legal review remain outstanding.

## This execution increment

| ID | Feature / outcome | State | Evidence and next action |
|---|---|---|---|
| P0-01 | Public production source provenance | PRODUCTION VERIFIED (metadata and public GET only) | Vercel returned READY deployment `dpl_Af3vmLQDRc8gHXs8D1EAVN6wmaqF` on `eyloai.vercel.app`, source SHA `c7b331454d54ca72486a799994c13ca7cbec4aeb`. Public `/release.json`, `/api/deployment-status`, and `/api/capabilities` each returned HTTP 200 and both manifests reported that SHA. This proves release identity, not private workflows. |
| P0-02 | Scholarly discovery smoke | FAILED on observed production request | Public `openalex_works` smoke query returned HTTP 429. The deployed endpoint response was not retained in the probe report, so the exact upstream/quota subcause is unconfirmed. The local proxy change in this branch now sanitizes provider failures and emits stable codes; deploy and repeat one controlled request after review. |
| P0-03 | Authentication, account isolation and private persistence | BLOCKED | No authorized staging URL or disposable signed-in browser state is configured. Run the documented two-account acceptance only against isolated staging. |
| P0-04 | Migration history / database rollout | BLOCKED | `npm run db:review-plan` verified the local manifest (26 selected, 7 excluded, no local-plan issues) but reports remote history unverified and legacy timestamp risks. Reconcile hosted history and schema with the owner; do not apply SQL. |
| P0-05 | EYRA live generation and scientific quality | PARTIAL / NOT STAGING VERIFIED | Public capability reports `ai: true`, which is configuration evidence only. No authenticated provider completion, claim-source review, or durable action was executed. |
| P0-06 | Production security settings | BLOCKED | The latest hosted review records leaked-password protection disabled. It requires a Supabase administrator change and Security Advisor recheck. No production Auth setting was modified. |
| P0-07 | Release governance | BLOCKED | The latest hosted review records `main` unprotected. This GitHub integration returned 403 for the branch-protection endpoint, so current rules could not be independently re-read here. An owner must configure required checks/review and verify enforcement. |
| P1-01 | Provider failure handling | IMPLEMENTED LOCALLY | `api/discovery.js` now returns generic, uncached provider errors with stable codes and a bounded numeric `Retry-After`, rather than relaying untrusted provider error bodies. Regression tests cover redaction and 429 behavior. Not deployed. |
| P1-02 | Public release probe diagnostics | IMPLEMENTED LOCALLY | `src/lib/deployment-probe.mjs` recognizes safe source error codes, including provider rate limiting, without retaining raw response bodies. Not deployed. |
| P1-03 | Full local code quality | LOCALLY VERIFIED | `npm run check` passed after the changes: import check, both TypeScript projects, ESLint, all Node tests, Vite production build and bundle budget. The build emits existing large-chunk and mixed dynamic/static Supabase import warnings; it remains under the configured regression ceiling. |
| P1-04 | Browser acceptance | BLOCKED BY EXECUTION ENVIRONMENT | `test:e2e:ux` requires `EYLO_E2E_BASE_URL` and an authorized `EYLO_E2E_STORAGE_STATE`. The landing and discovery-gateway tests could not find the Playwright Chromium executable. Careers could not launch `/usr/bin/chromium` because the sandbox denies its process socket (`Operation not permitted`). Product browser E2E also lacked Playwright Chromium. These are not product test passes or product failures. |
| P2-01 | Local deployment configuration | BLOCKED / NOT CONFIGURED IN THIS WORKSPACE | `npm run config:check` reported the Supabase server keys, OpenAI, Resend and Stripe environment settings absent. This is a local environment diagnostic; no secret values were read or changed. |
| P2-02 | Billing/contact operations | DISABLED | Public capabilities report `contact: false` and `billing: false`. Live payment or contact delivery was not attempted. |

## Feature inventory and integration map

The 77 product rows in `PRODUCT_IMPLEMENTATION_TRACKER.md` remain the per-feature execution records. The following repository artifacts are the source inventories for the other requested system classes:

| Inventory | Source of truth | Current verification boundary |
|---|---|---|
| Frontend routes and screens | `src/App.jsx`, `docs/FULL_SITE_FUNCTIONAL_AUDIT.md`, `docs/eylo-2030-screen-inventory.md` | Static route/source inspection; authenticated browser acceptance incomplete |
| Components and interactive workflows | `src/components/`, `src/pages/`, product rows in `docs/PRODUCT_IMPLEMENTATION_TRACKER.md` | Source and fixture tests; no full control-by-control hosted acceptance |
| API endpoints and server services | `api/`, `server/`, `supabase/functions/` | Unit/API fixture coverage in `tests/`; hosted provider/auth behavior partial |
| Tables, migrations and policies | `supabase/migrations/`, `docs/PRODUCTION_RLS_VERIFICATION_CHECKLIST.md`, `docs/EYRA_HOSTED_SCHEMA_PREFLIGHT.md` | Local SQL review and fixtures; hosted schema history and two-account acceptance blocked |
| External providers and AI tools | `api/discovery.js`, `api/eyra.js`, `src/lib/product-registry.mjs`, `docs/EYRA_TOOL_REGISTRY.md` | Local contract tests; real provider reliability and authenticated EYRA completion unverified |
| Billing, flags and environment dependencies | `api/billing.js`, `api/stripe-webhook.js`, `server/capabilities.js`, `.env.example` | Local gate tests; live Stripe remains disabled and staging credentials absent |
| CI/CD and deployments | `.github/workflows/`, `vercel.json`, Vercel deployment metadata | Local `npm run check` passed; production SHA confirmed; branch rules and hosted functional behavior remain open |

For the detailed lifecycle dependency map and safety boundaries, reuse [INTEGRATED_EYLO_EYRA_AUDIT_2026-11-18.md](INTEGRATED_EYLO_EYRA_AUDIT_2026-11-18.md), [PRIVACY_DATA_FLOW.md](PRIVACY_DATA_FLOW.md), [EYRA_AGENT_ARCHITECTURE.md](EYRA_AGENT_ARCHITECTURE.md), and [EYRA_ACTION_PERMISSION_MATRIX.md](EYRA_ACTION_PERMISSION_MATRIX.md).

## Verification record

| Check | Result | Notes |
|---|---|---|
| `npm ci` | PASS | Installed locked dependencies; no tracked lockfile change. |
| `npm run check` (baseline) | PASS | 1,220 tests passed before this increment. |
| `npm run check` (after changes) | PASS | Includes the new regression test; no failing test, typecheck, lint or build step. |
| `npm run db:review-plan` | PASS, local-only | Local migration plan is internally consistent; not a remote migration authorization. |
| `npm run release:readiness` | NO-GO | Evidence file does not establish current-commit staging, privacy, UX, operations or legal acceptance. |
| `npm run release:probe` | PROBE FAILED | Provenance passed; discovery returned HTTP 429; contact and billing configuration are false. Probe is read-only except for one normal discovery-quota request. |
| `npm run config:check` | CONFIGURATION INCOMPLETE | Workspace has no service credentials. |
| Browser E2E | BLOCKED | Missing authorized storage state and unavailable/blocked browser runtime as detailed above. |

## Existing report equivalents

Do not duplicate these reports under new names. They remain the detailed audits for the corresponding areas:

- Architecture: [INTEGRATED_EYLO_EYRA_AUDIT_2026-11-18.md](INTEGRATED_EYLO_EYRA_AUDIT_2026-11-18.md), [EYRA_AGENT_ARCHITECTURE.md](EYRA_AGENT_ARCHITECTURE.md)
- Feature verification: [FULL_SITE_FUNCTIONAL_AUDIT.md](FULL_SITE_FUNCTIONAL_AUDIT.md), [PRODUCT_IMPLEMENTATION_TRACKER.md](PRODUCT_IMPLEMENTATION_TRACKER.md)
- EYRA verification: [EYRA_PRODUCT_VERIFICATION_REPORT.md](EYRA_PRODUCT_VERIFICATION_REPORT.md), [EYRA_2030_EVIDENCE_RELEASE_GATE.md](EYRA_2030_EVIDENCE_RELEASE_GATE.md)
- Security: [AUTHENTICATION_SECURITY_AUDIT.md](AUTHENTICATION_SECURITY_AUDIT.md), [PRODUCTION_RLS_VERIFICATION_CHECKLIST.md](PRODUCTION_RLS_VERIFICATION_CHECKLIST.md)
- Database: [LEGACY_SCHEMA_REPAIR.md](LEGACY_SCHEMA_REPAIR.md), [EYRA_HOSTED_SCHEMA_PREFLIGHT.md](EYRA_HOSTED_SCHEMA_PREFLIGHT.md)
- Scientific evaluation: [DISCOVERY_EVALUATION.md](DISCOVERY_EVALUATION.md), [quality/eylo-scientific-production-audit.md](quality/eylo-scientific-production-audit.md)
- Billing: [LAUNCH_READINESS_GATE.md](LAUNCH_READINESS_GATE.md), `api/billing.js` and its sandbox tests
- UX/accessibility: [PRODUCT_UX_AUDIT.md](PRODUCT_UX_AUDIT.md), [eylo-2030-usability-protocol.md](eylo-2030-usability-protocol.md)
- Operations/release: [EYLO_HOSTED_GATE_REVIEW_2026-11-21.md](EYLO_HOSTED_GATE_REVIEW_2026-11-21.md), [LAUNCH_READINESS_GATE.md](LAUNCH_READINESS_GATE.md)
- Company readiness: [EYLO_COMPANY_READINESS_2026-11-21.md](EYLO_COMPANY_READINESS_2026-11-21.md), [RESEARCH_VALIDATION_AND_PILOT.md](RESEARCH_VALIDATION_AND_PILOT.md)

## Next tasks

1. Review and merge the local provider-error hardening through the repository's normal PR checks.
2. Deploy that reviewed commit only through the existing release process; rerun the public probe once and retain the safe source code/status.
3. Obtain isolated staging Supabase identity, two disposable accounts, and an authorized browser storage state; execute auth, data isolation, Library, Project, EYRA, file, mobile and recovery workflows.
4. Reconcile remote migration versions against reviewed SQL and actual schema without changing production history.
5. Have the Supabase owner enable leaked-password protection, then retest Auth and Security Advisor.
6. Have the repository owner enforce main branch review/check rules and confirm the rule blocks an intentionally failing PR.
7. Keep contact, live payments, external pilot, and schema rollout disabled until their existing owner/legal gates pass.
