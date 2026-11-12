# EYLOAI product ecosystem roadmap

**Reviewed:** 2026-11-12
**Code baseline:** `main` at `78b6c04`
**Purpose:** authoritative inventory for the 47-product ecosystem brief, 10 strategic innovations, and the existing EYLO research platform. This is an engineering tracker, not a production-readiness claim.

## Status definitions

- **Implemented in code:** a primary workflow is present on the reviewed branch. This does not certify production configuration, deployed behavior, security acceptance, or scientific quality.
- **Partial:** useful related code exists, but the requested workflow or its end-to-end acceptance is incomplete.
- **Not implemented:** no verified primary workflow was found in the reviewed records.
- **Blocked:** code exists or is in review, but an external account, deployment, provider, or owner action prevents acceptance.
- **Not audited:** requires a route-level review before assigning a stronger status.

## Current P0 blockers

| Blocker | Evidence / scope | Next action |
|---|---|---|
| Production build identity and API routing | Main smoke checks do not establish deployed SHA; the Vercel connection cannot see an EYLO project. Open recovery work is tracked in [PR #384](https://github.com/panagiotagrosdouli/eyloai/pull/384). | Review and merge only after CI and code review; redeploy through the owning Vercel project and verify served SHA and JSON API routes. |
| Production Supabase and RLS | Intended project and disposable test accounts are not available to the connected account. | Owner identifies the project; apply/review migrations in staging and run two-account read/write/delete isolation checks. |
| Provider configuration | AI, contact, billing, scheduled monitoring and institution analytics are not verified as production-ready. | Configure each service separately after its security and failure-mode acceptance; leave capability flags disabled until then. |
| Discovery abuse controls | Shared rate limiting remains an open P0. Proposed implementation and rollout runbook: [PR #382](https://github.com/panagiotagrosdouli/eyloai/pull/382). | Review database migration and privacy/fair-use tradeoffs; apply in an authorized staging project and verify concurrent limits before release. |
| Human-judged research quality | No human-labeled retrieval evaluation set or gap-quality evaluation is recorded. | Create domain- and intent-stratified labels; report retrieval and error metrics before claiming research quality. |
| Legal and account lifecycle acceptance | Privacy/terms and account deletion are not verified. | Service owner completes jurisdiction-specific review and authorizes deletion/export acceptance tests. |

## New product portfolio (47)

| # | Product | Priority | Status on reviewed main | Dependencies / next verifiable milestone |
|---:|---|---|---|---|
| 01 | EYLO Life | P3 | Partial | Reuse projects, tasks and milestones; define a user-owned personal-goals model, then deliver create/edit/complete/reload with ownership tests. |
| 02 | EYLO Calendar | P4 | Partial | Meeting plans and tentative calendar export exist; add persistent event/reminder/recurrence model and test timezone and reminder behavior. External OAuth waits for a supported authorized provider. |
| 03 | EYLO Notes | P2 | Not audited | Inspect project notes and idea records; define versioned, searchable notes with owner/workspace boundaries and export. |
| 04 | EYLO Spaces | P2 | Partial | Current private workspace is user-scoped; design membership, roles and workspace scoping before adding shared spaces. |
| 05 | EYLO Memory | P3 | Partial | Opt-in personalization work exists in open/recent EYRA changes; add inspect/edit/delete/consent and workspace scope tests before availability. |
| 06 | EYLO Notifications | P2 | Partial | In-app notification records exist; complete read/unread preferences and prove real delivery outcomes. Email or scheduled delivery requires configured providers. |
| 07 | EYLO Personal Dashboard | P2 | Partial | Build from existing project, task, research and activity records; verify every count against persisted user data. |
| 08 | EYLO Learn | P3 | Not implemented | Build course/lesson/objective records and one complete progress-and-assessment workflow; only add grounded content with provenance. |
| 09 | EYLO Study Planner | P3 | Not implemented | Depends on Calendar and Learn; persist syllabus, study sessions and examination dates, then test rescheduling and progress. |
| 10 | EYLO Flashcards | P3 | Not implemented | Depends on Learn and shared persistence; implement editable decks, review history and deterministic spaced-repetition scheduling. |
| 11 | EYLO Quiz Generator | P3 | Not implemented | Depends on authorized files/lessons and AI orchestration; implement source-bound questions, grading, explanations and saved results. |
| 12 | EYLO Skills | P3 | Partial | Existing research workflows cover parts of scientific methods/data analysis; add practice, feedback provenance and progress for each supported skill. |
| 13 | EYLO Career | P3 | Partial | Careers and profile surfaces exist; complete job-search records, skills alignment and user-controlled progress. |
| 14 | EYLO CV Builder | P3 | Partial | Profile and pitch/document surfaces exist; implement validated CV sections and DOCX/PDF export without invented qualifications. |
| 15 | EYLO Interview Simulator | P3 | Not implemented | Depends on Career and AI; persist sessions, user responses and feedback, with explicit limits on automated evaluation. |
| 16 | EYLO Files | P2 | Partial | Local Research Data Lab is browser-only; audit existing attachments, then implement private storage, metadata, parsing, deletion and authorization. |
| 17 | EYLO Create | P3 | Partial | Grant, briefing and pitch workflows exist; unify into editable source-backed artifacts and verified downloads. |
| 18 | EYLO Document Editor | P3 | Partial | Existing generated deliverables are not a general versioned editor; implement autosave, recovery, versions and export. |
| 19 | EYLO Presentations | P3 | Partial | Pitch Deck exists; verify actual editable slide persistence and valid PPTX export before broadening availability. |
| 20 | EYLO Spreadsheets | P3 | Partial | Data Lab analyzes local CSVs; add safe editable tabular data, validated formulas, chart persistence and XLSX export. |
| 21 | EYLO Universal Search | P2 | Partial | Scholarly search and search history exist; implement authorized cross-source search over saved projects, notes, files and activities with pagination. |
| 22 | EYLO Translate | P3 | Not implemented | Requires configured AI/provider and file/document permissions; implement editable translations with terminology and export. |
| 23 | EYLO Knowledge Graph | P2 | Implemented in code | Source-backed graph over saved papers, researchers and projects is on main; expand authorized entity coverage and verify two-user isolation. |
| 24 | EYLO Agent | P3 | Partial | EYRA performs bounded research actions; add a tool registry, persisted execution records, cancellation/retry and confirmation for writes. |
| 25 | EYLO Workflow Builder | P4 | Not implemented | Depends on stable shared action APIs and authorization; persist validated workflow definitions and execution/error records. |
| 26 | EYLO Automations | P4 | Partial | Scheduled monitoring code exists but is not configured as an available user feature; verify scheduler, pause/cancel and run history. |
| 27 | EYLO Research Radar | P4 | Partial | Research/funding watchlists and monitoring exist; prove deduplication, change tracking, delivery outcomes and recovery in configured staging. |
| 28 | EYLO Voice | P4 | Partial | Voice workspace and LiveKit meeting code exist; transcription/playback, recording consent and retention remain unverified. |
| 29 | EYLO Smart Import | P2 | Not implemented | Depends on Files and shared data models; implement preview, validation, deduplication, rollback and import history. |
| 30 | EYLO AI Verification | P2 | Partial | Citation/provenance and source-text checks exist; expand reference resolution and evaluate false positives/negatives. Never claim truth guarantees. |
| 31 | EYLO Export Center | P2 | Partial | CSV/JSON and some document exports exist; inventory actual formats and validate file integrity for PDF, DOCX, PPTX, XLSX, RIS, BibTeX and JSON. |
| 32 | EYLO Teams | P4 | Partial | Native meeting membership/token foundations exist; secure team spaces, roles, invitations, shared tasks and two-account tests are open. |
| 33 | EYLO Meetings AI | P4 | Partial | Meeting plans/notes and LiveKit exist; agenda-to-actions synchronization and authorized transcription are not complete. |
| 34 | EYLO Connect | P4 | Not implemented | No provider OAuth integration was verified; select providers and scopes before implementing token lifecycle and reconnection. |
| 35 | EYLO Community | P5 | Not implemented | Requires explicit public/private moderation and abuse model before discussions or shared resources are exposed. |
| 36 | EYLO Marketplace | P5 | Not implemented | Requires vetted extension/provider interface, permissions, review and billing boundaries; do not expose decorative listings. |
| 37 | EYLO Studio | P5 | Partial | Charts and research visuals exist in individual tools; unify editable diagram/figure workflows and verify exports. |
| 38 | EYLO Activity History | P2 | Partial | Research history exists; add auditable cross-product events and retention/export controls with privacy tests. |
| 39 | EYLO Admin Operations | P0 | Partial | Service status/capability endpoints exist; complete protected diagnostics, operational health and usage without exposing secrets or personal data. |
| 40 | EYLO Feature Health | P0 | Partial | Capability readiness exists; distinguish code, configuration, provider health and end-to-end proof for each advertised service. |
| 41 | EYLO Auto-Save | P2 | Partial | Some project records persist; standardize visible save state, retries, conflict detection and draft recovery across editors. |
| 42 | EYLO Self-Healing | P0 | Partial | Bounded provider retries exist in research retrieval; add safe retry/circuit-breaker policy and observable recovery for remaining services. |
| 43 | EYLO Offline | P5 | Not implemented | Requires a conflict-aware local data model; specify offline-capable operations and never imply cloud AI works offline. |
| 44 | EYLO Accessibility | P2 | Partial | Keyboard and accessible graph/list work exists; complete WCAG 2.2 AA review across core workflows and responsive layouts. |
| 45 | EYLO Onboarding | P3 | Not audited | Inspect first-use flows; add guided setup only for real features and verify skip/recovery behavior. |
| 46 | EYLO Feedback | P2 | Partial | Contact endpoint exists but is not production configured; verify secure bug-report submission, privacy-conscious diagnostics and receipt semantics. |
| 47 | EYLO AI Workspace Command Center | P3 | Partial | EYRA is a research assistant, not a cross-product execution center; wait for shared action APIs, then execute authorized workflows with reviewable steps. |

## Strategic innovations (10)

These are tracked separately from the 47 named products. Status reflects verified code on the reviewed `main`; related features do not count as a complete innovation.

| # | Innovation | Status on reviewed main | Dependencies / next verifiable milestone |
|---:|---|---|---|
| 01 | EYLO Evidence Ledger | Partial | Citation provenance and source verification exist; implement claim-linked evidence records with retrieval time, support/counterevidence, validation state and project association. Test immutable source facts and user ownership. |
| 02 | EYLO Research Reproducibility Studio | Partial | Data Lab provides local SHA-256 provenance; add methodology records, dataset metadata, reusable protocols and reproducibility checklists without uploading private raw data. |
| 03 | EYLO Research Collaboration Matcher | Partial | Researcher discovery exists; build explainable public-record matching, verified affiliation provenance and user-controlled shortlist actions. |
| 04 | EYLO Academic Writing Assistant | Partial | EYRA and report workflows can produce source-aware text; add editable outlines, literature synthesis and citation formatting with academic-integrity boundaries and export validation. |
| 05 | EYLO Methodology Coach | Partial | Research Landscape can offer suggestions; implement a source-aware study-design workflow that explains assumptions and limitations and never invents results. Validate with domain reviewers. |
| 06 | EYLO Peer Review Workspace | Not implemented | Depends on versioned document editing and source verification; add structured comments, tracked issues, evidence checks, revisions and private review history. |
| 07 | EYLO Project Intelligence | Partial | Projects, tasks and evidence context exist; add explainable risk/dependency analysis from persisted project records with user review and correction. |
| 08 | EYLO Knowledge Timeline | Partial | Research/search history and project activity exist; implement dated, source-linked topic/project timelines and test ordering, provenance and deletion behavior. |
| 09 | EYLO Decision Workspace | Partial | Opportunity comparison and project planning exist; add persistent options, criteria, evidence, uncertainty, scenario comparison and recorded rationale. |
| 10 | EYLO Research-to-Product Studio | Partial | Idea Vault, briefings and pitch workflows exist; connect them into a research-backed proposal flow with validated requirements and no invented demand or market metrics. |

## Existing research platform inventory

Status is intentionally conservative: these are required surfaces from the original EYLO brief, and a route/menu entry alone does not count as complete.

| Existing module | Status | Next acceptance step |
|---|---|---|
| Research Calls | Partial | Verify source freshness, filters, save/reload and provider failures. |
| Funding & Calls | Partial | Verify official-source fields, user-scoped saves, expiry handling and supported-region coverage. |
| Library | Partial | Complete authorized persistence, source integrity, export and deletion checks. |
| Research Gap Finder | Partial; live literature-search work in [PR #379](https://github.com/panagiotagrosdouli/eyloai/pull/379) | Review provider coverage, persistence, human judgments and failure handling. |
| Research Data Lab | Partial | Complete browser/mobile accessibility acceptance; preserve the local-only privacy model unless user-controlled persistence is designed. |
| For You | Not audited | Inspect recommendation inputs, provenance, personalization controls and empty/error states. |
| Workspace | Partial | Verify project ownership, task persistence, recovery and cross-workspace boundaries. |
| Idea Workspace | Partial | Verify create/edit/link/export and project-switch behavior. |
| Meetings | Partial | Verify two-account authorization, real media, mobile behavior and migration/RLS state. |
| Search History | Partial | Verify retention, deletion, export and owner isolation. |
| Settings | Not audited | Review privacy, consent, account, accessibility and service preference controls. |
| Open Challenges | Partial | Preserve official call facts; verify save/reload and source links. |
| Live Sources | Partial | Exercise provider status, timeout, rate-limit and malformed-response handling. |
| Executive Briefing | Partial | Verify source citations, uncertainty labels and downloadable output. |
| Opportunity Review | Partial | Verify official-source metadata and project-linked persistence. |
| Research Landscape | Partial | Keep generated candidates tied to retrieved source IDs; evaluate with human review. |
| Impact Review | Partial | Verify assumptions, evidence provenance and edit/save behavior. |
| Scenario Planner | Partial | Verify assumptions, calculations, persistence and sensitivity analysis. |
| Team Planner | Partial | Verify recommendations are explainable and do not imply consent or confirmed participation. |
| Voice Workspace | Partial | Verify consent, provider configuration, transcript handling and retention. |
| Grant Workspace | Partial | Preserve official call facts and verify draft isolation by project and opportunity. |
| Pitch Deck | Partial | Verify editable slides, autosave and valid PPTX output. |
| Profile | Partial | Distinguish self-reported from verified fields and add visibility/export/deletion controls. |
| Plans & Access | Partial / blocked | Verify Stripe test-mode lifecycle and server-controlled entitlements before enabling plans. |
| Workspace Analytics | Blocked | Requires authorized project, explicit activation, privacy review and verified aggregate queries. |
| Ask EYRA | Partial / blocked | Verify auth/quota/provider configuration, evidence provenance and controlled live-model behavior. |
| Service Status | Partial | Report configuration and actual health separately; protect operational details. |

## Shared infrastructure dependencies

1. **P0 foundations:** verified deployment identity, explicit service configuration, Supabase tenant/RLS, auth/data isolation, rate controls and operational health.
2. **P2 shared platform:** workspaces and permissions, persistent files/projects/tasks/notes, autosave, activity history, notifications, exports and authorization-aware search.
3. **P3 user workflows:** Learn, Life, Study Planner, Flashcards, Quizzes, Career, Skills, Create, Agent and command center, built on shared records rather than parallel stores.
4. **P4 collaboration and automation:** Teams, Calendar, Meetings AI, Connect, Radar and Automations, each gated on provider and two-account acceptance.
5. **P5 advanced products:** Community, Marketplace, Studio, Offline and new integrations after security, moderation and accessibility design.

## Session update protocol

For each implementation increment, record the reviewed commit, code changes, exact checks and results, open PR, external blockers, production status and next action in [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md). Change a status above only when its primary workflow has evidence. Keep production verification separate from local or mocked tests.
