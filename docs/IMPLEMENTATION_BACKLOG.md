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

### 1. Research Knowledge Graph — source-backed saved-collection graph implemented; coverage is partial

- [x] Build sourced nodes for saved publications, exact-ID authors/researchers, institutions, OpenAlex topics, projects and researcher-authored study-design notes.
- [x] Add only traceable edges for publication authorship, work affiliations, indexed topics, citations between papers in the saved collection and saved project links; use stable OpenAlex IDs and source URLs.
- [x] Mark shared-topic paper similarity as inference; provide filters, keyboard node navigation, zoom/pan, related-record inspection and an accessible relationship list.
- [ ] Expand source metadata coverage for legacy saved papers without authorship/topic/reference IDs; no names are merged without matching OpenAlex IDs.
- [x] Reuse the user's existing saved-library and project records for persistence; provide loading, empty, partial-load, error and retry states with graph-model tests.
- [ ] Verify two-user isolation and source completeness against the intended Supabase project.

### 2. Scientific Evidence Matrix — partial

- [x] Select project-linked saved papers and compare source metadata with editable study-design, dataset, findings and limitations notes.
- [x] Preserve source links and distinguish unrecorded information from negative findings; all comparison notes are explicitly researcher-authored.
- [x] Persist the selection and notes on the owner-scoped project record; add title/author filtering and CSV export.
- [ ] Test authenticated persistence and source fidelity in the intended Supabase project; no live account was available.

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

### 9. Research Data Lab — implemented for local analysis; hosted persistence intentionally off

- [x] Add browser-only CSV parsing with 5 MB, 10,000 row, 50 column and per-cell limits; files are not uploaded or sent to AI.
- [x] Add preview, missingness/distinct counts, numeric summaries, sample standard deviation, selectable row chart, and reproducible calculation notes.
- [x] Export the summary as CSV with formula-safe text fields; clear local data on demand and on page exit.
- [x] Cover quoted fields, malformed rows, bounds, missing data, statistics, chart selection and safe export with deterministic tests.
- [ ] Add desktop/mobile browser E2E and review screen-reader chart rendering; data remains session-only until a user-controlled project-save design is specified.

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

### 12. Meetings and collaboration — native call implementation partial; team collaboration not implemented

- [x] Preserve a personal meeting plan, agenda, notes, tentative calendar file and manually tracked proposal/response status. Creating a plan does not send an invitation or confirm attendance.
- [x] Keep historical external meeting links as HTTPS links that open separately; remove public Jitsi room creation and embedding from new meeting flows.
- [x] Add a LiveKit SFU browser room with camera, microphone, screen-share, participant tiles, device choice, in-call chat, full-screen, connection state and leave/end actions.
- [x] Add server-authenticated LiveKit access tokens (10-minute TTL), host-only room lifecycle, pseudonymous participant identity, owner-created email-bound invitation tokens (7-day expiry), and membership checks.
- [x] Add `meeting_participants` RLS migration and document LiveKit/Supabase configuration and self-hosting requirements.
- [ ] Verify meeting and project ownership with two authorized accounts against the intended Supabase project.
- [ ] Add team membership, invitations, participation requests, discussions and shared tasks with explicit role checks and consent.
- [ ] Apply the new migration to staging and configure a LiveKit endpoint, API key and API secret; no media provider or credentials are configured by this code change.
- [ ] Verify real-time audio/video, screen sharing, chat, reconnection and mobile behavior from two independent authenticated accounts. Local API tests are not proof of live media.
- [ ] Verify cross-user RLS and host/member/unauthorized join behavior in a production-matching staging deployment.

## Shared integration and verification

- [ ] Connect all completed features through consistent project context, navigation and saved workspace records.
- [ ] Keep EYRA source-dependent claims linked to retrieved evidence; separate facts, extracted information, inference and uncertainty.
- [ ] Add complete unit, API, authorization and browser end-to-end coverage for the core research workflow.
- [ ] Verify loading, empty, error, mobile, keyboard and reduced-motion states.
- [ ] Run `npm run check` after each focused change and record actual results below.
- [ ] Verify the intended live deployment and service configuration before any production-readiness claim.

## Work recorded

- **2026-11-12:** Funding search now supports comparing up to three current official-source opportunities side by side. The comparison uses the current filtered records, only renders approved official HTTPS links, displays structured source metadata safely, and labels missing source data. Keyboard access, mobile overflow, the three-item cap, and new-search cleanup are covered in an authenticated browser test. Node tests include provider-shaped Grants.gov and EU response fixtures plus ranking/compare compatibility. Updated-branch `npm run check` and `node --check tests/e2e-auth.mjs` passed; Chromium execution is blocked in this sandbox. The original Vercel check failed at the account build-rate-limit URL.
- **2026-11-12:** GitHub browser CI exposed a render crash when a provider supplied a structured EU budget value. Funding cards now format structured amounts as plain text before rendering; the authenticated browser fixture asserts the rendered EUR budget. Full local `npm run check` and E2E syntax validation pass after the fix. GitHub browser rerun is required to verify the correction; Vercel Preview remains blocked by the account build-rate-limit check.
- **2026-11-12:** Funding ranking validates known IDs and score/difficulty data before merging model estimates, keeps official-source facts immutable, and leaves partial/invalid ranks explicitly unscored. Updated branch `npm run check` passed locally; the authenticated browser fixture is in CI but browser execution in this sandbox is blocked by Chromium socket permissions.

- **2026-11-10:** Research Landscape now labels model output as candidate questions, includes retrieved abstract excerpts in the model context, requires exact paper IDs, drops candidates without a matching retrieved context record, links context and counterevidence records, and explains that retrieved papers do not establish a research gap. Added unit coverage for source-ID validation.
- **2026-11-10:** Project Evidence adds a source-linked, editable matrix for linked papers; notes are stored on the project and exported as CSV with spreadsheet formula escaping. Missing notes are shown as unrecorded rather than inferred.
- **2026-11-10:** Research Data Lab adds private, in-browser CSV preview, validation, missingness and numeric summaries, an accessible row chart, reproducible analysis steps, and formula-safe summary export. Dataset contents are not uploaded, persisted, or sent to AI.
- **2026-11-10:** PR #300 routes signed-in users from public entry pages back into their protected workspace destinations and makes Careers accessible inside workspace navigation. PR #299 ignores stale authentication operation results and states accurately that email request acceptance is not delivery confirmation. Neither verifies live production email or session flows.
- **2026-11-10:** Meetings now reject non-HTTPS or credential-bearing links, create Jitsi rooms only with cryptographically random IDs, and use keyboard-operable meeting-card buttons. Jitsi is still a public third-party service, not an EYLO access-controlled room.
- **2026-11-10:** Knowledge Graph now derives source-backed author, institution, topic, citation and project links from user-saved records. Citations require both OpenAlex IDs and both works in the user's Library; inferred shared-topic links have separate styling and caveats. Added filters, zoom/pan, related-node exploration and an accessible list.
- **2026-11-10:** Added mocked-auth browser regressions for keyboard opening meeting cards, rejecting unsafe legacy meeting URLs, and navigating a saved-paper graph with source citation links. These fixtures do not test production account isolation or live Jitsi calls.
- **2026-11-10:** Replaced new Jitsi room creation/embedding with a native LiveKit room, Supabase-authenticated server token endpoint, email-bound invitations, owner/member checks, RLS migration, and configuration documentation. Existing meeting URLs remain external links for compatibility. This code is not operational until staging infrastructure is configured.
- **Validation:** `npm run check` passed after the native meeting implementation: local imports, frontend/API type checks, ESLint, 297 unit/API tests and Vite production build. Vite reports existing dependency annotation and large-chunk warnings. Live two-account media, microphone/camera, screen share and deployed authorization remain untested because no staging LiveKit endpoint or credentials are configured.
- **Validation:** Local `npm run check` passed on this Knowledge Graph branch: imports, both TypeScript projects, ESLint, 265 tests and Vite production build. `node --check tests/e2e-auth.mjs` and `git diff --check` passed. Local Playwright launch of system Chromium was denied by host socket permissions; the expanded browser scenario awaits GitHub Actions. Vite emitted dependency annotation and large-chunk warnings.
- **Live public smoke:** HTTP 200 for `/`, `/manifest.webmanifest`, `/robots.txt`, `/discover`, `/login`, `/register`, `/forgot-password`, and `/api/capabilities`. This checks HTTP availability only; authenticated workflows, deployed commit, database isolation and provider readiness were not verified.
- **2026-11-12:** The funding browser regression now scopes its official-link count to exact comparison-table link names; the prior broad locator counted both card links and comparison links. CI is rerunning the combined flow after correcting that assertion.
- **2026-11-12:** The combined browser suite returns to a desktop viewport before the shared sign-out assertion so the mobile navigation collapse does not hide that control. GitHub Actions confirmed the funding flow itself passes; the suite rerun now covers sign-out and the downstream grant/literature scenarios.
