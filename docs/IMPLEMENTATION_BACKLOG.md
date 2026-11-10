# EYLO integrated implementation backlog

**Source:** repository review of the current `main` checkout on 2026-11-10. This is an implementation register, not a release-readiness claim. “Partial” means related routes or services exist; it does not certify end-to-end behavior, persistence or production configuration.

## Release blockers

- [ ] Verify the intended Vercel project/domain mapping and deployed commit. The 2026-11-07 audit reported 404s; a fresh 2026-11-10 smoke check returned HTTP 200 for all eight public routes/endpoints, but the connected Vercel account currently lists zero projects, so deployment provenance and project settings remain unverified.
- [ ] Restore production AI, contact, billing and scheduled-monitoring configuration only after their individual backend/security acceptance checks. `/api/capabilities` currently reports `ai`, `contact`, `billing`, `scheduled_monitoring` and `institution_analytics` as disabled.
- [ ] Verify that production Vercel environment variables point to the intended Supabase project; review live RLS and prove cross-user read/update/delete isolation with disposable accounts.
- [ ] Complete authenticated browser coverage for sign-in, discovery, saving, project context, EYRA and funding on desktop and mobile.
- [ ] Run a human-judged discovery evaluation. Existing heuristic coverage is not a scientific relevance benchmark.
- [ ] Verify billing lifecycle, entitlements and signed webhooks in Stripe test mode before enabling paid plans.
- [ ] Resolve retention, privacy-policy, legal-terms and account-deletion requirements with the service owner; repository notes say account deletion is not yet verified.
- [ ] Add a shared discovery rate limiter and test provider timeouts, 429s and response-size failures.

## Feature checklist

### 1. Research Knowledge Graph — not implemented as a connected graph

- [ ] Model sourced nodes for publications, researchers, institutions, topics and methods.
- [ ] Add only traceable edges (citation, authorship, affiliation, topic) with provider record IDs and source links.
- [ ] Implement filter, expansion, keyboard-accessible exploration and project saving.
- [ ] Add ownership, persistence, empty/error states and focused integration tests.

### 2. Scientific Evidence Matrix — not implemented

- [ ] Select saved or retrieved publications and compare study design, methods, dataset, findings and limitations.
- [ ] Preserve field-level provenance and distinguish missing information from negative findings.
- [ ] Support editable comparisons, filters, project linking and export.
- [ ] Test source fidelity and ensure model output cannot fill missing research details as fact.

### 3. AI Research Gap Finder — partial

- [x] Reframe landscape-generated “gaps” as tentative, source-linked research questions; validate every model-supplied paper ID against retrieved OpenAlex records.
- [ ] Add a broader, reproducible literature-review protocol and retrieval-coverage display.
- [ ] Persist reviewed candidates to a project with evidence and counterevidence.
- [ ] Evaluate false-positive and false-negative gap suggestions against human-reviewed cases.

### 4. Smart Researcher Matching — partial

- [ ] Inspect current People, Researcher and Dream Team flows for exact matching inputs and persistence.
- [ ] Add explainable expertise overlap/complementarity derived from scholarly metadata.
- [ ] Integrate saved matches with Projects and Research Passport.
- [ ] Add privacy-aware, consent-based collaboration requests and two-account access tests.

### 5. AI Research Project Planner — partial

- [ ] Extend Projects beyond milestones/ideas into tasks, dependencies, deliverables and progress.
- [ ] Generate a reviewable draft plan from project context; require user acceptance before saving.
- [ ] Link accepted plan items to EYRA, evidence, grants and monitoring.
- [ ] Test ownership, persistence, editing, deletion and failure recovery.

### 6. EYRA Peer Review Simulator — not implemented

- [ ] Add private manuscript upload with file validation, bounded processing and deletion controls.
- [ ] Assess reporting completeness, methods, citation integrity and reproducibility with evidence locations.
- [ ] Separate major concerns, minor concerns, strengths and actionable recommendations.
- [ ] Label model inference, preserve uncertainty, and state that this does not replace expert review.
- [ ] Test file security, authorization, citation checks and provider failure handling.

### 7. Research Radar — partial

- [ ] Verify topic/author/paper/funding watchlists, deduplication, notification history and delivery claims.
- [ ] Add a verified scheduler path and observable run history; keep scheduled updates unavailable when unconfigured.
- [ ] Test ownership, source outages, duplicate events, retries and notification delivery outcomes.

### 8. Grant Proposal Assistant — partial

- [ ] Retain official funding links and verify all shown dates/eligibility/budget fields against source records.
- [ ] Draft objectives, work packages, impact, timeline and structure from a selected project and call.
- [ ] Mark model-generated proposal text as draft and require human review.
- [ ] Add project linking, export and tests for missing/expired funding metadata.

### 9. Research Data Lab — not implemented

- [ ] Build bounded, private CSV upload and validation with explicit size/row limits.
- [ ] Add descriptive statistics, missingness checks and interactive plots with reproducible settings.
- [ ] Provide downloadable outputs and clear warnings about assumptions and data handling.
- [ ] Test malformed/oversized files, privacy boundaries and deterministic calculations.

### 10. Reproducibility Checker — not implemented

- [ ] Review supplied manuscript/materials for methods, data/code availability, statistics and experimental conditions.
- [ ] Return evidence-located findings and missing-information indicators.
- [ ] Distinguish reporting completeness from proof that results reproduce.
- [ ] Test citations, extraction errors, unsupported claims and document privacy.

### 11. EYLO Research Passport — partial

- [ ] Audit Profile for editable interests, publications, skills, background, projects, collaborations and career/funding interests.
- [ ] Add explicit public/private controls and distinguish verified metadata from self-reported fields.
- [ ] Integrate Passport with People, Careers, Projects, Funding and researcher matching.
- [ ] Test user ownership, export, deletion and privacy defaults.

## Shared integration and verification

- [ ] Connect all completed features through consistent project context, navigation and saved workspace records.
- [ ] Keep EYRA source-dependent claims linked to retrieved evidence; separate facts, extracted information, inference and uncertainty.
- [ ] Add complete unit, API, authorization and browser end-to-end coverage for the core research workflow.
- [ ] Verify loading, empty, error, mobile, keyboard and reduced-motion states.
- [ ] Run `npm run check` after each focused change and record actual results below.
- [ ] Verify the intended live deployment and service configuration before any production-readiness claim.

## Work recorded

- **2026-11-10:** Research Landscape now labels model output as candidate questions, includes retrieved abstract excerpts in the model context, requires exact paper IDs, drops candidates without a matching retrieved context record, links context and counterevidence records, and explains that retrieved papers do not establish a research gap. Added unit coverage for source-ID validation.
- **Validation:** `npm run check` passed: imports, both TypeScript projects, ESLint, 227 tests, and Vite production build. Vite emitted dependency annotation and large-chunk warnings. `git diff --check` passed.
- **Live public smoke:** HTTP 200 for `/`, `/manifest.webmanifest`, `/robots.txt`, `/discover`, `/login`, `/register`, `/forgot-password`, and `/api/capabilities`. This checks HTTP availability only; authenticated workflows, deployed commit, database isolation and provider readiness were not verified.
