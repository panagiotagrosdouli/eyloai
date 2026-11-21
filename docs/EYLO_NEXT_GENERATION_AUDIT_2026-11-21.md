# EYLO Next Generation audit | 21 November 2026

Baseline: GitHub main at `3c6061c67c587a78e27f314b448c326cd2dc1a1e` (PR #585). The source inventory includes 77 entries in `src/pages`, 12 Vercel API entry points, 33 SQL migration files and eight GitHub workflows. This first pass covers the architecture and major workflow families. Authenticated hosted workflows and individual routes still require acceptance evidence.

## A. Architecture and feature status

React/Vite entry points in `src/main.jsx` and `src/App.jsx` route the public site and workspace. `vercel.json` routes system functions, the Supabase proxy and scheduled monitoring. Vercel serves APIs in `api/`; shared authorization, adapters and execution logic live in `server/`. Supabase Auth and PostgREST are consumed via `src/lib/supabaseClient.js` and `src/lib/AuthContext.jsx`. Core migrations create profiles and owner-scoped workspace rows; later migrations add notes, files, search, grants, monitoring, EYRA conversation snapshots and the run/action ledger. Project associations span project IDs and JSONB workspace records. Inspect hosted columns, grants, foreign keys and RLS individually before treating local migrations as hosted truth.

| Workflow | Status | Evidence and acceptance gap |
|---|---|---|
| Public entry points | Verified functional for HTTP route delivery | Landing, discover, login, register, recovery, robots, manifest and capabilities returned expected public responses. Client sign-in and keyboard usability need separate evidence. |
| Release identity against current main | Broken | The public manifest and deployment-status API both reported `bd9e97232142e2704757200ec31d90bcbd4c990f` at audit time. GitHub compare showed main 68 commits ahead. Cause of the alias lag remains unverified. |
| Discovery and researcher lookup | Functional with limitations | `api/discovery.js`, `server/scholarly-resilience.mjs` and `src/pages/PublicResearchers.jsx`. One live OpenAlex result returned a DOI that resolved with HTTP 200. Other adapters, DOI retrieval, filters, quota behavior, and author/institution quality require provider-by-provider acceptance. |
| Auth and account isolation | Partially functional | `AuthContext.jsx`, `server/eyra-auth-boundary.mjs`, `tests/e2e-session-boundary.mjs`, and `docs/TWO_ACCOUNT_RLS_ACCEPTANCE.md`. Route availability and fixtures establish partial evidence. Hosted confirmation, recovery, account switching and cross-owner access remain open. |
| Projects, Library, Files, Notes and Tasks | Partially functional | `src/pages/ProjectDetail.jsx`, `Library.jsx`, `EyloFiles.jsx`, `Notes.jsx`, and `20261112190430_eylo_files.sql`. Staged persistence, reload, export, account switching, Storage and concurrent update acceptance remain open. |
| EYRA live responses | Partially functional | `api/eyra.js`, `server/eyra-provider-contract.mjs`, `server/eyra-usage-boundary.mjs`. The capability flag is true. The prior audit records an incomplete authenticated provider answer. A fresh complete, source-backed hosted stream is still required. |
| EYRA approvals and durable history | Blocked by configuration for hosted acceptance | `api/eyra-approve.js`, `api/eyra-conversations.js`, `server/eyra-run-ledger.mjs`, `server/eyra-tool-executor.mjs`. Prior dated inspection reported missing hosted conversation and ledger tables. Current preview failed. Verify live schema plus two-user save, export, replay and explicit approval before enabling durable claims. |
| Literature review and evidence | Partially functional | `src/pages/LiteratureReview.jsx`, `src/lib/literature-review-protocol.mjs`, `evidence-verification.mjs` and `evidence-matrix.mjs`. Validate source-to-excerpt entailment, abstract/full-text scope, reviewed evidence extraction, deduplication and export lineage. Formal systematic-review acceptance remains outstanding. |
| Gaps, hypotheses and reproducibility | Partially functional | `src/pages/ResearchGaps.jsx`, `src/lib/research-gap-coverage.mjs` and `src/components/projects/ReproducibilityReview.jsx`. Review contrary evidence and search bounds with domain experts. |
| Funding and collaboration | Partially functional | `api/opportunities.js`, `src/pages/GrantBuilder.jsx`, `CollaborationTools.jsx`, `api/meeting-room.js`. Validate official records, changing dates, eligibility, collaborator roles and actual meeting access. Prior evidence records EURAXESS ingestion blocked by upstream access. |
| Contact, monitoring, billing, institution analytics | Blocked by configuration on observed public deployment | `server/capabilities.js` reported all four false. Billing is outside this implementation. |
| Privacy and account deletion | Partially functional | `server/account-deletion.js` and `20261114063216_account_deletion_lifecycle.sql`. Verify deletion, retained records, session revocation and private files with disposable staging identities. Compliance review remains separate. |
| Cross-product competitive benchmark | Not implemented as an independently measured comparison | `scripts/benchmark-relevance.mjs` is a deterministic regression. Human and live runners exist. There is no competitive superiority result in this audit. |

The main GitHub check list reported successful build and product-quality checks and a failed Supabase Preview. The previous readiness report documents migration-history divergence. The repository migration review found 26 selected and seven excluded files and flagged duplicate/legacy version risks. These observations do not establish the current preview failure's root cause.

Primary repo references: `docs/EYLO_EYRA_RELEASE_READINESS_2026-11-20.md`, `docs/RESEARCH_TOOLS_ACCEPTANCE_2026-11-19.md`, `docs/EYRA_ACTION_PERMISSION_MATRIX.md`, `docs/PRIVACY_DATA_FLOW.md`, `supabase/migration-review-plan.json`, `.github/workflows/quality.yml`.

## B. Competitive gaps

| Product | Documented capability to compare | EYLO gap to measure |
|---|---|---|
| [Elicit](https://elicit.com/) | Literature review, screening and structured extraction | Track reviewer decisions, evidence excerpts and reproducible extraction/export lineage. |
| [Consensus](https://consensus.app/home/) | Scholarly retrieval with paper-linked answers | Measure relevance, source coverage, unsupported-claim rate and time to inspect the underlying paper. |
| [Scite](https://scite.ai/) | Citation statements and supporting/contrasting citation context | Require inspected excerpts and explicit coverage before labeling agreement or disagreement. |
| [NotebookLM](https://notebooklm.google/) | Source-grounded analysis of a selected document collection | Measure source-to-project handoff and continued access to evidence, decisions and exports after reload. |
| [ChatGPT Deep Research](https://openai.com/index/introducing-deep-research/) | Multi-step research and cited reports | Measure task completion and auditable actions from discovery through project execution. |

EYLO's candidate advantage is continuity from source discovery to a reviewed claim, project decision and research output. Benchmark robotics, clinical evidence, humanities, social science and environmental science with dated, reusable tasks and independently reviewed ground truth. Record retrieval precision@10, DOI validity, excerpt support, abstention on absent evidence, time and cost per successful task, accessibility, and failure rate. Keep fixture and live results separate and publish sample size, plan tier, date and coverage.

## C. Prioritized roadmap

1. **A — P0, release visibility and staging.** Require reviewed SHA in public smoke. Trace Vercel alias assignment and Supabase Preview failure. Reconcile migration history on a disposable staging branch. Establish two authorized staging identities and current provider acceptance.
2. **B — P1, scientific reliability.** Verify each provider and add human-graded relevance and evidence tests. Preserve DOI, version, source excerpt, access level and conflicting evidence through export. Test abstract-only and no-evidence cases.
3. **C — P1, EYRA.** After hosted dependencies pass, verify provider completion and auditable owner-scoped writes with explicit exact-field approval, retry safety and durable outcomes.
4. **D — P1, integrated research.** Verify discovery → save → screen → extract → compare → reviewed gap → hypothesis → method → task → export. Expand cross-discipline review templates and add verified official funding, budget and team handoffs.
5. **E — P2, competitive validation.** Run the shared benchmark against documented competitor workflows and publish measured limits.
6. **F — P2, commercial readiness.** Validate the existing company and onboarding answers against actual features, test accessible five-minute activation, validate support and privacy workflows, and gate billing on separate authorization and provider verification.

## D. First implementation

`.github/workflows/public-production-smoke.yml` requires the operator's reviewed SHA. `scripts/smoke-public.mjs` checks both frontend and backend evidence when given the SHA. `tests/public-smoke-provenance.test.mjs` executes the CLI against an isolated HTTP fixture for matching, stale, unverified and invalid identifiers. `docs/PUBLIC_SMOKE_TEST.md` documents the invocation. This change affects the release check and keeps the public product design intact.

## E. Validation and F. Release readiness

Local `npm run check` passed imports, type checking, lint, all 1,212 tests, production build and chunk budget. The modified smoke check rejected the production target against the audited main SHA at both identity endpoints. A live OpenAlex query returned “Managing Climate Change Refugia for Climate Adaptation,” DOI `10.1371/journal.pone.0159909`, whose resolver returned 200. This is one retrieval check. The deterministic relevance benchmark passed all five fixture cases and DOI suffix preservation. The local migration plan check passed with historical reconciliation outstanding.

**Release decision: hold the broader EYLO Next Generation release.** The canonical alias serves a different commit, Supabase Preview is failing, and successful EYRA provider generation and hosted two-user isolation remain unverified. The stabilization PR is for review. The observed capability flags do not verify the associated customer workflows.
