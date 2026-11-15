# EYLO — Unified 77-product implementation and acceptance register

**Inspection snapshot:** 2026-11-15. **Sources:** both owner-provided full-platform engineering specifications; `docs/integration/baseline-product-matrix.json`; current GitHub `main` file tree; read-only connected Supabase public table inventory; verified Vercel deployment metadata. The historical baseline is **not** fresh proof of live feature behavior.

**Release decision: NO-GO for a claim of complete platform readiness.** The current production Vite deployment was READY at commit `901d107d55cb2d8344c82cfa44850ab56f28c1dc`. A distinct, draft fix PR #455 is awaiting final acceptance and has **not** been promoted. No owner-confirmed isolated Supabase staging project/two disposable users, real cross-account RLS workflow, complete browser pass for all 77 products, payment lifecycle, backup restore, human research-source grading or owner sign-off have been verified.

## What was actually implemented in the current repair sequence

- The owner-confirmed production Supabase project `kbzjngpzxpniaumlupaa` received targeted migrations for private Files and versions, Notes, Flashcards, Calendar, Research Data Lab metadata, canonical Time Tracker/Quiz/Learning, Activity History, Workspace Search, Private Files Search and Time Tracker pause/resume. Live table presence and RLS flags were verified; **real two-account operations and storage upload were not**.
- Draft PR [#455](https://github.com/panagiotagrosdouli/eyloai/pull/455): reconnect/visibility retry after a transient capabilities request failure and strict OpenAlex errors in Research Landscape, plus regression tests. A Vercel preview build succeeded. Hosted authenticated action tests remain outstanding.
- Production Vercel has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY` (only variable names were inspected; no secret values read). **Provider credentials needed for Resend, Stripe and optional LiveKit remain unverified/missing.** Never interpret configuration presence as provider acceptance.
- Existing appearance, light/dark/system theme, user content, pricing gates and production deployment were not modified by PR #455.

## Status definitions

- **Implemented, pending live verification** = current repository source exists; does **not** establish successful integration or UI acceptance.
- **Partially functional** = prior tracker says partial or integration incomplete, or current structural evidence is insufficient.
- **Blocked by external dependency** = provider/staging/approval required before real acceptance.
- **Not implemented** = historical baseline reported no implementation and no corresponding tracked source file is present on current main; revisit when detailed route/source review contradicts this.
- **Verified functional** = complete user action, persistence, authorization and live integration independently passed. **No product is assigned this status without test evidence.**

## Complete product matrix (historical tracker + current source and schema reconciliation)

| ID | Product | Baseline state (historical) | Main tracked source files present | Required Supabase entities present | Current acceptance status |
|---:|---|---|---:|---:|---|
| 1 | EYLO Life | Partially implemented | 4/4 | 2/2 | Partially functional |
| 2 | EYLO Calendar | Partially implemented | 2/2 | 1/1 | Partially functional |
| 3 | EYLO Notes | Partially implemented | 2/2 | 2/2 | Partially functional |
| 4 | EYLO Spaces | Not implemented | 0/0 | 0/0 | Not implemented |
| 5 | EYLO Memory | Not implemented | 0/0 | 0/0 | Not implemented |
| 6 | EYLO Notifications | Partially implemented | 2/2 | 1/1 | Partially functional |
| 7 | EYLO Personal Dashboard | Partially implemented | 1/1 | 6/6 | Partially functional |
| 8 | EYLO Learn | PR-only | 0/0 | 0/0 | Partially functional |
| 9 | EYLO Study Planner | Partially implemented | 1/1 | 2/2 | Partially functional |
| 10 | EYLO Flashcards | Partially implemented | 2/2 | 1/1 | Partially functional |
| 11 | EYLO Quiz Generator | PR-only | 0/0 | 0/0 | Partially functional |
| 12 | EYLO Skills | Not implemented | 0/0 | 0/0 | Not implemented |
| 13 | EYLO Career | Partially implemented | 8/8 | 1/1 | Partially functional |
| 14 | EYLO CV Builder | Partially implemented | 3/3 | 1/1 | Partially functional |
| 15 | EYLO Interview Simulator | Not implemented | 0/0 | 0/0 | Not implemented |
| 16 | EYLO Files | PR-only | 0/0 | 0/0 | Partially functional |
| 17 | EYLO Create | PR-only | 0/0 | 0/0 | Partially functional |
| 18 | EYLO Document Editor | PR-only | 0/0 | 0/0 | Partially functional |
| 19 | EYLO Presentations | Partially implemented | 1/1 | 1/1 | Partially functional |
| 20 | EYLO Spreadsheets | Not implemented | 0/0 | 0/0 | Not implemented |
| 21 | EYLO Universal Search | Partially implemented | 3/3 | 8/8 | Partially functional |
| 22 | EYLO Translate | Not implemented | 0/0 | 0/0 | Not implemented |
| 23 | EYLO Knowledge Graph | Partially implemented | 2/2 | 3/3 | Partially functional |
| 24 | EYLO Agent | Infrastructure only | 1/1 | 2/2 | Partially functional |
| 25 | EYLO Workflow Builder | Not implemented | 0/0 | 0/0 | Not implemented |
| 26 | EYLO Automations | Infrastructure only | 1/1 | 3/3 | Partially functional |
| 27 | EYLO Research Radar | Partially implemented | 2/2 | 3/3 | Partially functional |
| 28 | EYLO Voice | Partially implemented | 1/1 | 0/0 | Partially functional |
| 29 | EYLO Smart Import | Partially implemented | 1/1 | 0/0 | Partially functional |
| 30 | EYLO AI Verification | Partially implemented | 2/2 | 0/0 | Partially functional |
| 31 | EYLO Export Center | Partially implemented | 2/2 | 3/3 | Partially functional |
| 32 | EYLO Teams | Not implemented | 0/0 | 0/0 | Not implemented |
| 33 | EYLO Meetings AI | Partially implemented | 2/2 | 1/2 | Partially functional |
| 34 | EYLO Connect | Not implemented | 0/0 | 0/0 | Not implemented |
| 35 | EYLO Community | Not implemented | 0/0 | 0/0 | Not implemented |
| 36 | EYLO Discover | Partially implemented | 3/3 | 1/1 | Partially functional |
| 37 | EYLO Studio | Not implemented | 0/0 | 0/0 | Not implemented |
| 38 | EYLO Activity History | Partially implemented | 1/1 | 1/1 | Partially functional |
| 39 | EYLO Admin Operations | Not implemented | 0/0 | 0/0 | Not implemented |
| 40 | EYLO Feature Health | Partially implemented | 1/1 | 0/0 | Partially functional |
| 41 | EYLO Auto-Save | Partially implemented | 2/2 | 2/2 | Partially functional |
| 42 | EYLO Self-Healing | Not implemented | 0/0 | 0/0 | Not implemented |
| 43 | EYLO Offline | Not implemented | 0/0 | 0/0 | Not implemented |
| 44 | EYLO Accessibility | Partially implemented | 2/2 | 0/0 | Partially functional |
| 45 | EYLO Onboarding | Partially implemented | 1/1 | 1/1 | Partially functional |
| 46 | EYLO Feedback | Not implemented | 0/0 | 0/0 | Not implemented |
| 47 | EYLO AI Workspace Command Center | Partially implemented | 2/2 | 2/2 | Partially functional |
| 48 | Evidence Ledger | Partially implemented | 2/2 | 2/2 | Partially functional |
| 49 | Research Reproducibility Studio | Partially implemented | 2/2 | 1/1 | Partially functional |
| 50 | Research Collaboration Matcher | Partially implemented | 4/4 | 2/2 | Partially functional |
| 51 | Academic Writing Assistant | Partially implemented | 1/1 | 1/1 | Partially functional |
| 52 | Methodology Coach | Not implemented | 0/0 | 0/0 | Not implemented |
| 53 | Peer Review Workspace | Not implemented | 0/0 | 0/0 | Not implemented |
| 54 | Project Intelligence | Partially implemented | 1/1 | 1/1 | Partially functional |
| 55 | Knowledge Timeline | Partially implemented | 1/1 | 1/1 | Partially functional |
| 56 | Decision Workspace | Partially implemented | 2/2 | 1/1 | Partially functional |
| 57 | Research-to-Product Studio | Partially implemented | 2/2 | 1/1 | Partially functional |
| 58 | Research Intelligence | Partially implemented | 2/2 | 2/2 | Partially functional |
| 59 | Thesis Studio | Not implemented | 0/0 | 0/0 | Not implemented |
| 60 | Experiment Lab | Not implemented | 0/0 | 0/0 | Not implemented |
| 61 | Business Intelligence | Not implemented | 0/0 | 0/0 | Not implemented |
| 62 | Literature Review Studio | Partially implemented | 3/3 | 2/2 | Partially functional |
| 63 | Citation Network | Partially implemented | 2/2 | 1/1 | Partially functional |
| 64 | Research Ethics | Not implemented | 0/0 | 0/0 | Not implemented |
| 65 | Scientific Figures | Partially implemented | 4/4 | 0/0 | Partially functional |
| 66 | Research Journal | Not implemented | 0/0 | 0/0 | Not implemented |
| 67 | Academic Supervisor | Partially implemented | 4/4 | 2/2 | Partially functional |
| 68 | Conference Hub | Not implemented | 0/0 | 0/0 | Not implemented |
| 69 | Publication Tracker | Not implemented | 0/0 | 0/0 | Not implemented |
| 70 | Research Budget | Not implemented | 0/0 | 0/0 | Not implemented |
| 71 | Smart Forms | Not implemented | 0/0 | 0/0 | Not implemented |
| 72 | Survey Analytics | Partially implemented | 4/4 | 0/0 | Partially functional |
| 73 | Data Catalog | PR-only | 1/1 | 0/0 | Implemented, pending live verification |
| 74 | Project Templates | Partially implemented | 1/1 | 1/1 | Partially functional |
| 75 | Time Tracker | PR-only | 0/0 | 0/0 | Partially functional |
| 76 | API & Developer Hub | Not implemented | 0/0 | 0/0 | Not implemented |
| 77 | Institutional Portal | Partially implemented | 1/1 | 1/1 | Partially functional |

**Counts:** Partially functional: 49; Not implemented: 27; Implemented, pending live verification: 1. Counts reflect static, non-acceptance source inventory and must not be presented as verified features. Missing tracked sources can indicate baseline drift; authoritative functional status requires a specific route and user-workflow test.

## Live acceptance matrix (common requirements across all modules)

| Gate | Current evidence | Result |
|---|---|---|
| Version identity and build | Current Vercel production commit matches inspected GitHub main; existing main quality workflows passed | Build verified only |
| Source behavior | Draft PR #455 plus scoped unit/source assertions; broad frontend behavior not exercised on live authenticated accounts | Partial |
| Authentication | Supabase Auth configured; signup/login/reset/logout and session behavior not tested in isolated hosted staging | NOT RUN |
| Database/RLS | Owner-scoped policies/table presence verified for rebuilt modules; no two-disposable-user cross-account acceptance | NOT RUN |
| Storage | Private bucket and metadata/version structures exist; no real authenticated upload/download/version/read-denial acceptance | NOT RUN |
| AI/EYRA | Server-side `OPENAI_API_KEY` configured; actual source-grounded EYRA response/quotas/permissions not verified | NOT RUN |
| Scientific retrieval | Existing OpenAlex/arXiv/Crossref/Europe PMC/Semantic Scholar integration code; no multi-discipline human-reviewed result benchmark | NOT RUN |
| Automation | Existing watchlists/notifications/monitoring tables, no verified reliable scheduled execution/delivery/opt-out | NOT RUN |
| Collaboration | No verified member permission revocation, shared project controls, or two-user isolated staging | NOT RUN |
| Billing | Stripe live variables absent; test-mode full lifecycle and signed webhook acceptance absent; **no live charges authorized** | BLOCKED |
| Contact | Resend and sender/destination variables absent; actual delivery not tested | BLOCKED |
| Recovery | No independently tested staging backup restoration | NOT RUN |
| UX, themes and accessibility | Source theme manager exists; all navigation/mobile/keyboard and theme acceptance not rerun against live release | NOT RUN |
| Beta / legal | No observed real-user beta evidence or owner-accepted legal sign-off | NOT RUN |

## Additional production scheduler evidence (read-only)

- Live Supabase lists `scheduled-monitoring` as **ACTIVE**, Edge Function **version 1**, with `verify_jwt=false`. The deployed source uses a separate constant-time comparison against a stored hashed cron token; disabling JWT at the platform layer is **not** by itself proof that the endpoint is unauthenticated.
- The deployed version **differs** from the current tracked `supabase/functions/scheduled-monitoring/index.ts` source: the GitHub version imports bounded, validated research-provider response helpers instead of relying on unchecked response shapes. This is **verified deployment/source drift**, not authorization to auto-replace the live function.
- Confirm scheduled execution, intended cron identity, secret-hash setup, verified alert delivery and owner consent in staging; deploy a reviewed function only after migration/dependency checks and an explicit release decision. No live monitoring function was changed during this inspection.

## Safe next engineering increments

1. Review and complete PR #455 CI; perform actual hosted preview browser acceptance before merge. Do not promote just because build is green.
2. Establish **separate, verified Supabase staging** and synthetic A/B accounts; reproduce full CRUD/RLS/Storage concurrency, persistence and isolation; test actual backup restoration. Avoid writing synthetic records to production.
3. Reconcile open conflicting PRs by feature and review schema/order; implement remaining missing product paths in small PRs with realistic E2E tests.
4. Activate provider-backed capabilities only after credentials, consent, cost ceilings and integration checks are configured server-side. Test Stripe only in test mode; live billing requires a separate affirmative approval.
5. Score retrieved scientific results against a multi-disciplinary human-reviewed set with DOI/source verification and explicit uncertainty labels.
6. Require CI + staging integration + security validation + owner review before production promotion; capture deployment commit, failure logs and a reversible rollback route.

## Exclusions and safety

This register **does not** assert 77 live-functional products, pretend that a green build is an end-to-end test, or silently enable live billing/notifications. No destructive migrations, user-data deletions or production app changes are part of the register update. Both supplied owner specifications remain binding for subsequent work; this table is a fact-checked starting point for implementation, not a replacement for their complete functional requirements.
