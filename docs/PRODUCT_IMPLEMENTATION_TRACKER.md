# EYLO Product Implementation Tracker

This tracker preserves the requested 77-product inventory and reflects the current `main` branch plus active review branches as of 2026-11-12. Status applies to current `main` unless a row explicitly says “PR only.” `PARTIAL` means some real workflows exist; `FOUNDATION` means shared models or infrastructure exist; `NOT_STARTED` means no meaningful workflow is integrated on main. None of these labels imply staging or production acceptance.

## Current release evidence

- Audited `main`: `7bf956a72d42f251c77cde7276dcb050cebd1a35` (includes merged PR #396 and Decision Workspace #397).
- Dashboard, research modules, saved projects, and learning records still require authorized staging verification and representative cross-user checks.
- Decision Workspace: `PARTIAL` in main via merged PR #397. Frontend: `src/pages/ProjectDecisions.jsx`; route and project-list entry point: `src/App.jsx`, `src/pages/Projects.jsx`. Persistence: existing `projects.data.decision_records`, saved with `Project.updateIfUnchanged`; authorization inherits existing Project RLS and owner filter. No migration. Tests: domain validation unit tests plus 491 passing repository tests on the base; GitHub Actions build/import/verify/browser regressions passed on PR head `db61f36`. Staging, direct two-account RLS, and product-specific browser persistence remain unverified. Next: authorize staging/test accounts, exercise create/edit/delete/reload/concurrent conflict, then compare the route at desktop/mobile sizes.
- #397 is merged into this audited main. Its earlier PR verification notes above are historical; live staging and production acceptance remain unverified.

## Integration candidate (not main or a release)

Branch `codex/eylo-platform-integration-audit` adds the reviewed Files/Create/Document Editor work from #395, structured project workplans from #392, and metadata-only local Data Catalog/comparisons from #387. All remain partial products pending their full acceptance criteria. The branch preserves main's canonical Notes/Life/Calendar/Flashcards contracts rather than adding the competing schemas from #391/#393.

Continuation on 2026-11-13 adapts #391 Time Tracker/Quiz/Learn to canonical Notes and LifeTask, adds #393's distinct manual authoring behavior without its duplicate store, completes authenticated EYRA streaming and explicit conversation snapshots in canonical EYRA tables, and integrates the cumulative funding/research-gap stack with project-scoped drafts and canonical DOI uniqueness. One discovery limiter is selected; separate staging configuration is guarded. Candidate register: **49 partial, 27 not implemented, 1 infrastructure only; zero complete**. `npm run check`: **616 passed**, both browser fixture suites passed, and seventeen selected migrations passed on disposable PostgreSQL. Live scholarly coverage improved to 4/5 but the overall diagnostic still fails. Main-only rows below retain their historical meaning; the linked candidate matrix records branch changes.

Machine-readable registers: [current integration matrix](integration/product-matrix.json), [baseline matrix](integration/baseline-product-matrix.json), [65 open PR comparisons](integration/open-pr-comparison.json), and [migration overlap](integration/pr-migration-overlap.json). [Integration decisions](integration/INTEGRATION_DECISIONS.md) distinguish source inventory, local PostgreSQL policy tests, browser fixtures, live HTTP checks and remaining release gates.

The owner identified EYLO project `kbzjngpzxpniaumlupaa`; the connected Supabase account denied access, and the repository protects that live ref from staging writes. No remote migrations were applied. A separate authorized staging project and test accounts are still needed. No production promotion or live payments were enabled.

## Status definitions

- `NOT_STARTED`: no meaningful implementation integrated on main.
- `FOUNDATION`: shared models or basic infrastructure exist.
- `PARTIAL`: some real workflows are implemented; acceptance remains incomplete.
- `FUNCTIONALLY_COMPLETE`, `STAGING_VERIFIED`, `PRODUCTION_VERIFIED`, and `PRODUCT_EXCELLENCE_VALIDATED` require their evidence gates; none are claimed here.


## Personal productivity

| ID | Product | Status |
|---|---|
| 1 | EYLO Life | PARTIAL in main: goals with measurable milestones, daily habit check-ins, tasks with daily/weekly recurrence, and dated completion records. |
| 2 | EYLO Calendar | PARTIAL in main: owner-scoped event workflow and month filtering; reminders are not verified as delivered and external OAuth sync is absent. Next: verify persistence in staging and implement configured delivery. |
| 3 | EYLO Notes | PARTIAL in main: rich-text editing, autosave, tags, search, pinning/favorites, notebooks, subject links, templates, archived-note recovery, optimistic conflict protection, and database-backed version history with restore. |
| 4 | EYLO Spaces | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 5 | EYLO Memory | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 6 | EYLO Notifications | PARTIAL in main: in-app notifications and a bell exist; event coverage, preference controls and delivery are incomplete. Next: verify read/unread and preference persistence. |
| 7 | EYLO Personal Dashboard | PARTIAL in main after #396: real authorized project, note, task, calendar, study, saved research, and activity sources with retry/empty states. Next: staging authorization checks, mobile/visual review, and source-level user acceptance. |

## Education and career

| ID | Product | Status |
|---|---|
| 8 | EYLO Learn | NOT_STARTED on main; learning workspace implementation is PR-only in #391/#393. Next: select one learning data contract, then integrate and test lessons, assessment, and progress as a complete workflow. |
| 9 | EYLO Study Planner | PARTIAL in main: subjects, exam dates, measurable session goals, rescheduling, 7/3/1-day revision planning, completion, and saved history. |
| 10 | EYLO Flashcards | PARTIAL in main: manual creation/editing, named collections, authorized note import, review outcomes, and SM-2 scheduling. |
| 11 | EYLO Quiz Generator | NOT_STARTED on main; quiz implementation is PR-only in #391/#393. Next: resolve the shared learning schema, then integrate manual authoring, grading, saved attempts, and review. |
| 12 | EYLO Skills | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 13 | EYLO Career | PARTIAL in main: career opportunity discovery and profile-linked CV support exist; verified opportunity completeness is not claimed. Next: track user-owned goals and portfolio progress. |
| 14 | EYLO CV Builder | PARTIAL in main: CV data and local document parsing exist; template editing and verified exports need acceptance. Next: validate saved versions and DOCX/PDF output. |
| 15 | EYLO Interview Simulator | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |

## Knowledge and creation

| ID | Product | Status |
|---|---|
| 16 | EYLO Files | NOT_STARTED on main; implementation proposal is PR-only in #395. Next: integrate secure upload, ownership, validation and version workflows after branch review. |
| 17 | EYLO Create | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 18 | EYLO Document Editor | NOT_STARTED on main; implementation proposal is PR-only in #395. Next: integrate editable documents and validate DOCX/PDF exports. |
| 19 | EYLO Presentations | PARTIAL in main: Pitch Deck authoring/export exists; a general editable presentation workspace is not complete. Next: verify PPTX export and round-trip editing. |
| 20 | EYLO Spreadsheets | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 21 | EYLO Universal Search | PARTIAL in main: bounded server-side, permission-aware search for supported workspace sources with pagination and exact-result links. Next: expand supported sources and verify authorization/scale in staging. |
| 22 | EYLO Translate | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 23 | EYLO Knowledge Graph | PARTIAL in main: research-paper/concept graph exists; it does not yet connect all authorized EYLO record types. Next: add cross-product records with exact source links and permissions. |

## AI and automation

| ID | Product | Status |
|---|---|
| 24 | EYLO Agent | FOUNDATION in main: EYRA tool/workflow foundations exist; durable authorized agent execution, cancellation and verified completion are not established. Next: build persisted runs with scoped approvals and audit outcomes. |
| 25 | EYLO Workflow Builder | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 26 | EYLO Automations | FOUNDATION in main: server-side scheduled monitoring exists; user-defined workflow scheduling, retries, cancellation and history are absent. Next: add durable user-owned jobs with idempotency and failure states. |
| 27 | EYLO Research Radar | PARTIAL in main: scholarly watchlists and scheduled source monitoring exist; alert coverage and user controls need verification. Next: validate source deduplication, persistence and delivery. |
| 28 | EYLO Voice | PARTIAL in main: voice workspace exists; provider readiness, consent and persistent audio workflows require verification. Next: validate enabled speech services and accessible transcripts. |
| 29 | EYLO Smart Import | PARTIAL in main: supported CV/file parsing exists; no universal preview/mapping/rollback import flow. Next: build format validation and import history. |
| 30 | EYLO AI Verification | PARTIAL in main: citation/reference validation and source provenance checks exist; this is not general truth verification. Next: add claim-to-source comparison and human review. |
| 31 | EYLO Export Center | PARTIAL in main: bibliography, local CSV and workspace JSON exports exist; format coverage and integrity remain incomplete. Next: validate supported DOCX/PDF/PPTX/XLSX exports and formula-safe handling. |

## Collaboration

| ID | Product | Status |
|---|---|
| 32 | EYLO Teams | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 33 | EYLO Meetings AI | PARTIAL in main: meetings, project links and action/follow-up records exist; transcription/recording require configured consent and provider verification. Next: validate the complete authorized meeting journey. |
| 34 | EYLO Connect | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 35 | EYLO Community | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 36 | EYLO Discover | PARTIAL in main: live scholarly and opportunity discovery routes exist; recommendations remain source-limited. Next: improve transparent relevance and coverage. |
| 37 | EYLO Studio | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 38 | EYLO Activity History | PARTIAL in main: metadata-only owner-scoped records for supported writes; coverage is not a complete security audit trail. Next: verify transactional event coverage and retention in staging. |

## Platform quality

| ID | Product | Status |
|---|---|
| 39 | EYLO Admin Operations | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 40 | EYLO Feature Health | PARTIAL in main: service status reporting exists, but it does not verify every dependency or operational readiness. Next: replace hardcoded/partial states with real dependency checks and staging verification. |
| 41 | EYLO Auto-Save | PARTIAL in main for Notes: autosave, session recovery, versioning and conflict protection; no shared save service for all products. Next: exercise reload/network/conflict flows in staging and add other editors only with recovery guarantees. |
| 42 | EYLO Self-Healing | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 43 | EYLO Offline | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 44 | EYLO Accessibility | PARTIAL in main: shared keyboard/focus/label patterns and baseline checks exist; WCAG 2.2 AA is not verified. Next: audit representative desktop and mobile journeys. |
| 45 | EYLO Onboarding | PARTIAL in main: account/profile onboarding exists; goal-personalized first-task activation is not complete. Next: add user-selected goals and progress to a first real task. |
| 46 | EYLO Feedback | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 47 | EYLO AI Workspace Command Center | PARTIAL in main: global EYRA command surface exists; cross-product execution tracking and verified outcomes remain incomplete. Next: expose authorized tool runs and completion evidence. |

## Strategic innovations

| ID | Product | Status |
|---|---|
| 48 | Evidence Ledger | PARTIAL in main: project evidence matrix and source-linked records exist; no append-only claim/evidence ledger. Next: add traceable claims and contradictory-source review. |
| 49 | Research Reproducibility Studio | PARTIAL in main: project protocol/provenance review exists; it does not capture a full software/data environment or reproduce analyses. Next: extend traceable protocol, analysis and environment records. |
| 50 | Research Collaboration Matcher | PARTIAL in main: researcher matching/discovery exists; availability and willingness are not verified. Next: retain only public evidence and state matching limits. |
| 51 | Academic Writing Assistant | PARTIAL in main: EYRA and project writing assistance exist; complete source-grounded drafting/revision workflow is unverified. Next: add citation-linked editing with provenance and export. |
| 52 | Methodology Coach | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 53 | Peer Review Workspace | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 54 | Project Intelligence | PARTIAL in main: project-linked EYRA analysis, milestones and evidence exist; progress and risks are not fully verified. Next: ground summaries in recorded data and show evidence links/limits. |
| 55 | Knowledge Timeline | PARTIAL in main: project timeline surface and saved dates exist; it is not a cross-workspace knowledge history. Next: connect source records and decision history with provenance. |
| 56 | Decision Workspace | PARTIAL in draft PR #397: project-scoped alternatives, criteria, sources, choice, rationale, review date and outcome with compare-and-set saves. No score is fabricated. Next: staging persistence, concurrency, permission and mobile acceptance. |
| 57 | Research-to-Product Studio | PARTIAL in main: project startup/product concept tooling exists; commercial validation is not established. Next: tie problem and experiment planning to recorded evidence. |

## Specialized products

| ID | Product | Status |
|---|---|
| 58 | Research Intelligence | PARTIAL in main: source-backed scholarly retrieval, saved papers and project-linked analysis exist; coverage and scientific conclusions remain bounded by retrieved records. Next: add monitored comparisons with explicit source provenance and failure states. |
| 59 | Thesis Studio | NOT_STARTED |
| 60 | Experiment Lab | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 61 | Business Intelligence | NOT_STARTED |
| 62 | Literature Review Studio | PARTIAL in main: protocol and screening workflows exist; completeness and PRISMA compliance are not claimed. Next: verify search/import/dedup/screening and evidence extraction in staging. |
| 63 | Citation Network | PARTIAL in main: research knowledge graph and citation metadata paths exist; coverage gaps remain. Next: validate provider identity and expose citation coverage limits. |
| 64 | Research Ethics | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 65 | Scientific Figures | PARTIAL in main: Research Data Lab plots local user datasets; it is not a general editable figure editor. Next: validate units, labels, calculations and export integrity. |
| 66 | Research Journal | NOT_STARTED |
| 67 | Academic Supervisor | PARTIAL in main: supervisor discovery and meeting planning exist; secure review/version workflow is absent. Next: add role-bound feedback and revision states. |
| 68 | Conference Hub | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 69 | Publication Tracker | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 70 | Research Budget | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 71 | Smart Forms | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 72 | Survey Analytics | PARTIAL in main: local Research Data Lab can analyze user-provided numeric data; survey-specific privacy/statistics workflows are absent. Next: validate authorized survey data handling and disclosure safeguards. |
| 73 | Data Catalog | NOT_STARTED on main; metadata-only local catalog is PR-only in #387. Next: review privacy and storage behavior, then integrate without uploading raw Data Lab contents. |
| 74 | Project Templates | PARTIAL in main: project templates create project drafts; broader linked-task/workflow creation remains. Next: validate resulting records and permissions. |
| 75 | Time Tracker | NOT_STARTED on main; implementation proposal is PR-only in #391. Next: review shared entity contracts, then integrate persisted entries and export. |
| 76 | API & Developer Hub | NOT_STARTED — define the core workflow, data/security model, tests, and dependencies before implementation. |
| 77 | Institutional Portal | PARTIAL in main: institutional analytics/admin surface exists; organization membership, delegated roles and privacy boundaries remain incomplete. Next: enforce institution roles without exposing personal records. |

## Next implementation

Review integration candidates #395, #391, #393 and #392 against current main before taking overlapping route/schema work. Complete authorized staging/RLS acceptance for merged productivity and dashboard flows. Continue with a non-overlapping dependency-ready workflow; do not mark PR-only implementations as integrated. Keep Vercel Preview and production unverified until deployment checks pass.

The next continuation (#402) adds canonical snapshot retry identity, export and confirmed deletion, late-history invalidation and Reproducibility checklist CAS, verified locally with browser fixtures and independent PostgreSQL sessions. These do not certify hosted account deletion or any product as complete.

Research continuation adds DOI/provenance correctness and Literature Review conflict/reload/export fixture acceptance. The fresh real-provider diagnostic fails with strict coverage 3/5 (earlier 4/5 is historical). Totals remain 49 partial, 27 not implemented, 1 infrastructure only; zero certified complete.
