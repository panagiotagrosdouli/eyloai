# EYLO platform implementation checklist

This is the working implementation register for the master EYLO platform brief. Status reflects repository code and recorded evidence reviewed on 2026-11-10; a feature is not marked complete because a route or prototype exists. Production, database, scientific-quality, and browser acceptance require separate evidence.

## Priority 0 — Reliability and safety

- [x] Inspect current architecture, README, technical/security audits, migrations, tests, deployment workflows, and recent project history.
- [ ] Verify the intended production Vercel project, deployed commit, and serverless configuration. **Partial:** public production smoke passed 8/8 on 2026-11-10, but `release.json` omits the Git SHA and Vercel project provenance remains unverified; public capability flags currently report AI, contact, billing, monitoring, and analytics disabled.
- [ ] Verify production Supabase project identity, applied migrations, RLS, and cross-user access isolation. **Not run:** no verified intended project and disposable accounts.
- [ ] Remove implicit Supabase project selection from all serverless handlers; add explicit configuration validation and regression tests. **Implemented on this branch; full check passed locally:** API fallbacks removed for EYRA, funding, billing, Stripe webhooks, and scheduled monitoring. Confirm every service remains operational only with the intended explicit environment.
- [ ] Verify auth redirects, persistence, export/deletion, billing entitlements, and secret handling in the deployed environment. **Production flows not run:** current main has bounded session restoration and Supabase request timeouts, retryable protected-route failures, safe redirects, and stable network/rate-limit/email-delivery error states; issue #295's real confirmation, magic-link, and recovery email delivery remains blocked on access to the verified production Supabase project, provider logs, and authorized test mailboxes.
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

- [x] Knowledge Graph — **Implemented on main; hosted-CI verified, with partial scope:** the graph draws from saved papers, researchers and projects; uses available OpenAlex authorship, affiliation, topic and in-library citation metadata; links factual edges to sources; labels inferred topic links; and supports filters, navigation, zoom/pan and an accessible relationship list. Expansion beyond saved metadata, metadata completeness, and live cross-user/RLS acceptance remain open.
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

- [x] Run typecheck, lint, unit tests, and production build for the reviewed branch. `npm run check` completed successfully on `d832051`; 302 repository tests passed, along with imports, both TypeScript projects, ESLint, and Vite production build.
- [ ] Add/run browser coverage for registration → discovery → save → project → EYRA and critical failure paths.
- [ ] Complete responsive, keyboard, screen-reader, contrast, and accessibility acceptance.
- [ ] Complete live RLS tests with two disposable accounts against the confirmed intended project.
- [ ] Complete groundedness evaluation for EYRA summaries and answers against frozen evidence packets.
- [ ] Record the exact deployment commit and actual preview/production status; do not deploy from this checklist.

## Current checkpoint — 2026-11-10

- Branch: current local review is based on `main` commit `d83205120f94c9cf4ae06ef8359830eade96660a`; PR #307 (Knowledge Graph) and PR #306 (Ideas browser regression fix) are merged. Hosted Build, EYLO Quality Gate, and Product quality browser checks passed on the graph PR head `2ed92c6` before merge.
- Current local verification: `npm run check` passed on `d832051`; imports, both TypeScript projects, ESLint, all 302 tests, and Vite production build passed. `node --check tests/e2e-auth.mjs` and `git diff --check` passed on the graph PR head.
- Open draft PRs #292 and #294 target an older base and currently conflict with main. Their changes overlap auth/session work already in main; #294's export schema also remains unverified. They were reviewed but not merged.
- Recent history reviewed: current main also adds owner-scoped paper-summary persistence and research workflow reliability tests; outstanding items remain in `docs/IMPLEMENTATION_BACKLOG.md`.
- Initial finding: `api/eyra.js`, `api/opportunities.js`, `api/monitor.js`, `api/billing.js`, and `api/stripe-webhook.js` could silently fall back to the hard-coded project `kbzjngpzxpniaumlupaa.supabase.co`. The funding and EYRA handlers also contained a hard-coded public key.
- Current change: added explicit server-side Supabase URL/key validation and removed the serverless project/key fallbacks. Regression tests confirm missing configuration makes no upstream request and configured requests use only the supplied project.
- Current core workflow change: extended the existing EYRA paper summarizer with three detail modes, abstract-only uncertainty rules, and explicit save-to-Project behavior while preserving any existing project link; available from Discovery, Library, and Project evidence views.
- Current paper Q&A change: added an abstract-grounded, temporary Ask This Paper conversation in the same Discovery, Library, and Project evidence views. Prior assistant answers are excluded from evidence context; displayed excerpts must match the abstract; stale answers are discarded on paper changes; page-level citations are not fabricated.
- Current paper workflow integration: incorporated the latest `main` updates for Europe PMC full-text retrieval and auth state handling. Full-text summaries and Q&A retain source-type labels and use only retrieved text; quotes are checked against that text.
- Current citation verification change: added fixed-host, exact DOI lookup through Crossref and a Library comparison of the DOI, normalized title, publication year, and first-author surname; mismatches and missing metadata remain explicit. Crossref update notices are reported with source and DOI; an absent notice is not treated as evidence of no retraction. Paper views also include AI-assisted user-claim checks against the available abstract/full text; positive verdicts require a verbatim matching source excerpt and the interface states this does not establish scientific correctness.
- Verification: the security, paper, citation, claim-check, graph, and latest-main integration changes passed imports, both TypeScript projects, ESLint, 302 unit tests, and the Vite build through `npm run check`. Existing dependency and bundler warnings are non-fatal. Hosted Build, EYLO Quality Gate, and Product quality browser checks passed on the graph PR head. The prior public smoke passed 8/8 on 2026-11-10, before the latest main updates. Public capability response reported all five optional services disabled. This does not verify account persistence, live RLS, provider access, or AI behavior.
- Deployment: unchanged. Exact deployment SHA and connected Vercel project remain unverified; no deployment or database changes were made.

## Continuation rule

Update this file after each verified focused change. Preserve blocked status when external project access, real human judgments, consent, or production configuration is unavailable. Do not convert planned work into completion claims.


## Latest continuation checkpoint — 2026-11-10

- Idea Vault browser recovery regression is fixed in merged PR [#306](https://github.com/panagiotagrosdouli/eyloai/pull/306), merge commit `cccfa6e9e5b71b3d0bb12e2634f42e064969b60f`. Its Build, EYLO Quality Gate, and Product quality workflows passed. The browser scenario verifies a controlled 503, the truthful visible error state, explicit retry, and isolated test-double CRUD; it does not verify live Supabase behavior or RLS.
- The recovery test keeps the first failure active until the explicit user retry and matches the exact title while requiring an explanatory detail. A one-shot mock was nondeterministic because a repeated request could succeed before the UI assertion.
- Source-backed Knowledge Graph shipped in PR [#307](https://github.com/panagiotagrosdouli/eyloai/pull/307), merge commit `d83205120f94c9cf4ae06ef8359830eade96660a`. Hosted Build, EYLO Quality Gate, and Product quality passed. Coverage is the saved collection and available source metadata; the broader graph requirements remain partial.
- Diagnostic PR #308 was closed without merge after PR #306 resolved the failure; no application behavior changed in #308.
- The Vercel status is failing because the linked account reached its daily deployment limit; this is not a successful preview or production verification. Exact Vercel project/deployed SHA and intended Supabase project identity, migrations, RLS isolation, and live auth/email remain unverified. No production changes were made.
- Team Planner researcher saving is implemented in open PR [#311](https://github.com/panagiotagrosdouli/eyloai/pull/311). Hosted Build, EYLO Quality Gate, and Product quality browser checks passed on head `967bcff7e11ff02bf712409d28c2446fae77018d`; the new flow uses isolated auth and provider/database test doubles. Production RLS and cross-user isolation are still unverified.
- Local Playwright execution in this workspace was blocked by Chromium socket restrictions; use the hosted browser workflow for browser verification. The passing #306 browser run is the actual hosted evidence for the corrected Idea Vault path.
