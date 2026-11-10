# EYLO platform implementation checklist

This is the working implementation register for the master EYLO platform brief. Status reflects repository code and recorded evidence reviewed on 2026-11-10; a feature is not marked complete because a route or prototype exists. Production, database, scientific-quality, and browser acceptance require separate evidence.

## Priority 0 — Reliability and safety

- [x] Inspect current architecture, README, technical/security audits, migrations, tests, deployment workflows, and recent project history.
- [ ] Verify the intended production Vercel project, deployed commit, and serverless configuration. **Partial:** public production smoke passed 8/8 on 2026-11-10, but `release.json` omits the Git SHA and Vercel project provenance remains unverified; public capability flags currently report AI, contact, billing, monitoring, and analytics disabled.
- [ ] Verify production Supabase project identity, applied migrations, RLS, and cross-user access isolation. **Not run:** no verified intended project and disposable accounts.
- [ ] Remove implicit Supabase project selection from all serverless handlers; add explicit configuration validation and regression tests. **Implemented on this branch; full check passed locally:** API fallbacks removed for EYRA, funding, billing, Stripe webhooks, and scheduled monitoring. Confirm every service remains operational only with the intended explicit environment.
- [ ] Verify auth redirects, persistence, export/deletion, billing entitlements, and secret handling in the deployed environment. **Not run.**
- [ ] Add abuse controls for public scholarly retrieval using a verified shared limiter and provider-safe quotas. **Open:** no verified shared limiter is configured.
- [ ] Complete recovery, monitoring, and production failure-state acceptance. **Not run.**

## Priority 1 — Core scientific intelligence

- [ ] Research Discovery — **Partial:** live scholarly indexes, deduplication, ranking, provider-status handling, source links, and saving exist; advanced filter coverage and independent relevance validation remain incomplete.
- [ ] EYRA Paper Summaries — **Partial:** authenticated discovery, Library, and Project evidence papers offer short/standard/detailed summaries from abstracts, with Europe PMC full-text retrieval for verified eligible PMCIDs and an explicit save action. Other full-text sources and persistent full-text storage are not implemented.
- [ ] Ask This Paper — **Partial:** a temporary page-local conversation is grounded only in the accessible abstract or retrieved Europe PMC text, displays only substantial quotes that exactly match supplied text, discloses uncertainty, and supports retry/clear. Paper switches discard stale responses. Persistent user-scoped history and full-text passage citations are not implemented.
- [ ] Compare Papers and Evidence Matrix — **Partial:** current main includes a project-linked, editable source-metadata matrix with researcher-authored notes and CSV export. Authenticated persistence and source fidelity are not verified against production accounts.
- [ ] Research Gap Finder — **Partial:** current main validates source IDs and frames landscape suggestions as candidate questions. Reproducible search coverage, persisted reviewed candidates, and human-judged gap quality remain open.
- [ ] Citation Verification — **Partial:** the Library performs exact Crossref DOI lookups and compares saved DOI, normalized title, publication year, and first-author surname; mismatches and unavailable fields are shown separately. Crossref-linked retraction and other update notices are surfaced with their source and record link. No listed notice is explicitly inconclusive. Paper views now offer AI-assisted claim-to-source-text checks that require an exact source excerpt for positive support labels; independent accuracy evaluation remains incomplete. These checks do not establish scientific correctness.
- [ ] Publish and independently review a human-judged retrieval benchmark. **Not run:** no genuine human relevance labels are present.

## Priority 2 — People, opportunities, and projects

- [ ] Researcher discovery — **Partial:** OpenAlex people/institution records and identity filtering exist; permitted photographs, verified biographies, ORCID reconciliation, and full identity provenance are incomplete.
- [ ] Researcher Matching — **Partial:** team-building and project intelligence exist; validated, explainable matching and consent-aware shortlist workflow need review.
- [ ] Funding Calls — **Partial:** authenticated Grants.gov and EU Funding & Tenders Portal retrieval now exist on current main; broader national/international coverage, robust field normalization, filters, saved-call alerts, and end-to-end acceptance remain open.
- [ ] Academic Careers — **Partial:** live and snapshot-backed opportunity sources exist; complete source verification, expiry handling, and tested CV relevance workflow remain incomplete.
- [ ] Project Planner — **Partial:** persistent projects, tasks, meetings, and milestones exist; work packages, dependencies, complete timeline/Kanban views, and integration acceptance remain open.
- [ ] Research Passport — **Partial:** editable profile exists; verified versus user-entered provenance and full visibility controls need completion.
- [ ] Collaboration Hub — **Partial:** meeting plans and related records exist; team discussions, secure invitation lifecycle, permissions, moderation, and two-account acceptance are not complete. Open PR work is not treated as released.
- [ ] Grant Proposal Assistant — **Partial:** grant drafting exists; official requirements versus suggestions and multi-call proposal integration need acceptance.

## Priority 3 — Advanced research workflows

- [ ] Knowledge Graph — **Not implemented as an interactive, source-backed graph.**
- [ ] Literature Review Builder — **Not implemented as an editable, source-grounded drafting workflow.**
- [ ] EYRA Peer Review Simulator — **Not implemented.**
- [ ] Research Data Lab — **Partial:** current main supports bounded, browser-only CSV analysis and formula-safe summary export. Data stays session-only; mobile/browser and accessible chart acceptance remain open.
- [ ] Reproducibility and Research Integrity — **Not implemented as a structured assistant; existing trust guidance is not a substitute.**

## Priority 4 — Ongoing research activity and EYRA integration

- [ ] Research Radar — **Partial:** watchlists, provider checks, stored discoveries, and scheduled monitoring exist; personalized researcher, career, and opportunity monitoring and alert acceptance remain incomplete.
- [ ] Notifications and email delivery — **Partial:** in-app notification records exist; configured delivery and opt-in preference verification are open.
- [ ] Unified EYRA — **Partial:** a server-side Responses API assistant and multiple contextual workflows exist; source-grounded paper actions and reliable shared context across the full research lifecycle remain open.
- [ ] Verify consent, data boundaries, provenance, uncertainty, and confirmation before saved-data changes across every assistant workflow. **Not run end to end.**

## Priority 5 — Release readiness

- [x] Run typecheck, lint, unit tests, and production build for the reviewed branch. `npm run check` completed successfully; 286 repository tests passed, along with imports, both TypeScript projects, ESLint, and Vite production build.
- [ ] Add/run browser coverage for registration → discovery → save → project → EYRA and critical failure paths.
- [ ] Complete responsive, keyboard, screen-reader, contrast, and accessibility acceptance.
- [ ] Complete live RLS tests with two disposable accounts against the confirmed intended project.
- [ ] Complete groundedness evaluation for EYRA summaries and answers against frozen evidence packets.
- [ ] Record the exact deployment commit and actual preview/production status; do not deploy from this checklist.

## Current checkpoint — 2026-11-10

- Branch: `codex/fail-closed-supabase`, merged with current `main` commit `6796941aaf1295bd4079e6524704f580b896ae83`; this includes newer auth/navigation work, Evidence Matrix, Research Data Lab, Research Gap candidate validation, and safer meeting links.
- Recent history reviewed: current main also adds owner-scoped paper-summary persistence and research workflow reliability tests; outstanding items remain in `docs/IMPLEMENTATION_BACKLOG.md`.
- Initial finding: `api/eyra.js`, `api/opportunities.js`, `api/monitor.js`, `api/billing.js`, and `api/stripe-webhook.js` could silently fall back to the hard-coded project `kbzjngpzxpniaumlupaa.supabase.co`. The funding and EYRA handlers also contained a hard-coded public key.
- Current change: added explicit server-side Supabase URL/key validation and removed the serverless project/key fallbacks. Regression tests confirm missing configuration makes no upstream request and configured requests use only the supplied project.
- Current core workflow change: extended the existing EYRA paper summarizer with three detail modes, abstract-only uncertainty rules, and explicit save-to-Project behavior while preserving any existing project link; available from Discovery, Library, and Project evidence views.
- Current paper Q&A change: added an abstract-grounded, temporary Ask This Paper conversation in the same Discovery, Library, and Project evidence views. Prior assistant answers are excluded from evidence context; displayed excerpts must match the abstract; stale answers are discarded on paper changes; page-level citations are not fabricated.
- Current paper workflow integration: incorporated the latest `main` updates for Europe PMC full-text retrieval and auth state handling. Full-text summaries and Q&A retain source-type labels and use only retrieved text; quotes are checked against that text.
- Current citation verification change: added fixed-host, exact DOI lookup through Crossref and a Library comparison of the DOI, normalized title, publication year, and first-author surname; mismatches and missing metadata remain explicit. Crossref update notices are reported with source and DOI; an absent notice is not treated as evidence of no retraction. Paper views also include AI-assisted user-claim checks against the available abstract/full text; positive verdicts require a verbatim matching source excerpt and the interface states this does not establish scientific correctness.
- Verification: the security, paper, citation, claim-check, and latest-main integration changes passed import checks, both TypeScript projects, ESLint, 286 unit tests, and the Vite build through `npm run check`. Existing date parsing, dynamic-import, and dependency warnings are non-fatal. The PR's Vercel check currently reports failure with a build-rate-limit URL; it is not represented as a successful preview. The prior public smoke passed 8/8 on 2026-11-10, before the latest main updates. Public capability response reported all five optional services disabled. This does not verify account persistence, live RLS, provider access, or AI behavior.
- Deployment: unchanged. Exact deployment SHA and connected Vercel project remain unverified; no deployment or database changes were made.

## Continuation rule

Update this file after each verified focused change. Preserve blocked status when external project access, real human judgments, consent, or production configuration is unavailable. Do not convert planned work into completion claims.
