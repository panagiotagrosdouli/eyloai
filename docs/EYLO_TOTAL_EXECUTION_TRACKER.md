Warning: truncated output (original token count: 17119)
Total output lines: 325

# EYLO total execution tracker

**Updated:** 28 November 2026 (Europe/Athens)

**Repository baseline:** `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace` (main after PR #637; repository-owner merges only)

**Working branch:** `codex/eylo-final-acceptance-20261128` (PR #640 continuation; no merge, deployment, or hosted migration)

## Current production and staging evidence — 28 November 2026

| Checkpoint | State | Evidence and limit |
|---|---|---|
| Production deployment | HOSTED_VERIFIED; RELEASE NO-GO | Vercel deployment `dpl_9roHjxRTLWfWfKARUnEzFsgzmrbX` is READY at exact main SHA `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace`, alias `eyloai.vercel.app`. Read-only `/`, `/discover` and `/login` returned HTTP 200; this is not authenticated workflow acceptance. |
| Production Supabase | BLOCKED BY 16 MISSING TABLES | Read-only inventory confirms 19 applied migration versions and 34 public tables, all listed with RLS. Missing: eyra_conversations, eyra_messages, eyra_agent_runs, eyra_agent_actions, grant_applications, meeting_participants, eylo_directory, eylo_teams, eylo_team_invites, eylo_team_members, eylo_connections, eylo_community_posts, eylo_peer_reviews, eylo_feedback, eylo_api_tokens, eylo_api_token_events. No migration was applied. |
| Billing and AI capability | OBSERVED | Production `/api/capabilities` returns `ai=true` and `billing=false`; billing remains disabled. Missing database tables still make durable EYRA persistence unavailable. |
| Hosted staging | BLOCKED BY FREE PROJECT CAP | Supabase rejected the authorized `eyloai-staging` create request in `panagiotagrosdouli's Org` / eu-north-1 at the Free two-project limit. `eyloai` is active; unrelated `job` remains inactive and untouched. Owner action: Supabase Dashboard → organization → Projects → New project in an isolated free-capacity organization/provider, or separately authorize paid capacity. No purchase is authorized. |
| Consolidated acceptance candidate | AUTOMATED_TESTS_PASSED; HOSTED VERIFICATION REQUIRED | PR #640 combines Auth cascade guards, real two-account Auth/Storage/export/deletion, EYRA run-API ownership and shared scholarly-provider cooldown handling. Exact-head CI passed; hosted verification and release remain blocked. |

## Final consolidation verification — 28 November 2026

**Reviewed candidate:** PR #640, exact current head `993df372b98b0ccda860feed633e5a4e9143a3ed`, base `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace`. Open, ready for review, mergeable, and unmerged. The prior consolidated head and its verified fixes are preserved in this history. PR #638's shared provider cooldown fix is integrated here and #638 is closed as superseded. #633, #635 and #636 are closed as superseded; #634 is merged.

**Current-head GitHub checks: PASS** — Build run `46170258150`; EYLO Quality Gate `46170258155`; disposable PostgreSQL/Supabase acceptance `46170258093`; Product Quality `46170258086`. These were independently fetched for exact head `993df372b98b0ccda860feed633e5a4e9143a3ed`. The prior runs recorded below are historical and do not replace these exact-head results.

The disposable stack replayed the reviewed migration order and verified privileges; it exercised real local Auth, PostgREST and Storage with two synthetic users. It passed account signup/login/refresh/session restoration/logout, all 17 required table accesses, project persistence and cross-account read/update/delete isolation, API token audit ownership/client write denial, EYRA conversation snapshot and ordered message persistence/isolation, production EYRA run API list/detail/cancel/delete ownership, Storage upload/download path isolation, complete owner-scoped workspace export, privacy deletion and Storage/data cleanup while preserving the second account. Network requests were restricted to loopback. Product Quality passed the distributed provider 429 regression, normalized Retry-After/cooldown handling and the existing product workflow suite. These are CI/disposable-environment results, not hosted user acceptance.

### Functional acceptance registry

| Feature | Source status | Automated evidence | Hosted acceptance |
|---|---|---|---|
| Database migrations and required tables | IMPLEMENTED | EXACT-HEAD CI PASS: disposable stack replay, privilege preflight and 17 table access; local `db:reconcile-manifest` valid (40 migration files, 7 pending, 18 exact SQL matches, 1 known divergence); `db:review-plan` valid (34 selected, 6 excluded, 4 history warnings) | BLOCKED: production still lacks 16 tables; migration history and legacy side effects require isolated staging reconciliation; no hosted migration applied |
| Authentication and session lifecycle | IMPLEMENTED | AUTOMATED_TESTS_PASSED: two local users, signup/login/refresh/restore/logout/relogin | BLOCKED: hosted two-account test requires isolated staging |
| Account/project isolation | IMPLEMENTED | AUTOMATED_TESTS_PASSED: read/write/delete ownership and export isolation | BLOCKED: hosted acceptance |
| Storage and privacy deletion | IMPLEMENTED | AUTOMATED_TESTS_PASSED: actual local Storage ownership, export, deletion and cleanup | BLOCKED: hosted acceptance |
| EYRA conversations and messages | PARTIALLY_IMPLEMENTED | AUTOMATED_TESTS_PASSED: durable local snapshot, ordered messages and isolation | BLOCKED: full model/tool/streaming run and hosted schema activation |
| EYRA agent run ledger API | IMPLEMENTED | AUTOMATED_TESTS_PASSED: list/detail/cancel/delete and owner isolation using live local Auth tokens | BLOCKED: hosted activation and end-to-end provider/tool execution |
| EYRA project context and research memory | PARTIALLY_IMPLEMENTED | Exact project ownership, bounded fields, permission-scoped context and canonical records covered in `eyra-workspace-context`, `eyra-retrieval-service`, conversation and Supabase acceptance tests | Semantic retrieval relevance, actual hosted model execution and restored history on isolated staging remain unverified |
| EYRA streaming, stop and recovery | PARTIALLY_IMPLEMENTED | Server stream, cancellation, timeout, partial-result rejection and safe recovery contracts pass in the full local suite; browser HTTP terminal-stream E2E attempted but blocked before execution by missing browser binary | Browser interaction and provider cancellation/recovery are not hosted-verified |
| Scholarly provider coordination | IMPLEMENTED | AUTOMATED_TESTS_PASSED: distributed leases/cache/quota and 429 Retry-After regression | BLOCKED: authorized bounded live OpenAlex/Semantic Scholar acceptance |
| Source discovery and transparent partial retrieval | PARTIALLY_IMPLEMENTED | Exact-head Product Quality passed; discovery/provider and retrieval failure fixtures cover deduplication and explicit partial/error state | No authorized live multi-provider search or relevance review in this execution |
| Evidence extraction and DOI identity | PARTIALLY_IMPLEMENTED | Exact excerpt verification, DOI normalization/identity, mismatch handling and correction/retraction notices covered by `evidence-verification` and `citation-verification` tests | Citation record accuracy and semantic support require source-level human review; no live-provider acceptance |
| Supporting/conflicting claims and abstract/full-text distinction | PARTIALLY_IMPLEMENTED | Claim assessment requires cited exact abstract excerpts; fabricated, unsupported and uncited verdicts fail closed; abstract-only evidence cannot imply full-text verification (`evidence-verification`, `scientific-evaluation`, project scientific review tests) | Full-text claim review and independent expert adjudication not executed |
| Research gaps, limitations and decisions | PARTIALLY_IMPLEMENTED | Research-gap candidate/context/project flows and project decision history have passing fixture/unit coverage; scientific caveats and unreviewed status are preserved | No completed human-validated gap analysis or hosted decision-history journey |
| Systematic review protocol and screening | PARTIALLY_IMPLEMENTED | `literature-review-protocol` covers question, search strategy, inclusion/exclusion, human reasons, deduplication guards, unsaved edits and JSON/CSV evidence exports; audit explicitly warns on incomplete coverage and avoids PRISMA claims | End-to-end search across databases, reviewer workflow and applicable PRISMA report not completed; not a completed systematic review |
| Methodology recommendations | PARTIALLY_IMPLEMENTED | Schema-complete proposed methods, selected-source restrictions, uncited-claim rejection, project save receipts and Markdown export covered by `research-methodology-studio` tests | No validated design recommendation or researcher sign-off; all generated methods remain proposals |
| Scientific evaluation and quality review | PARTIALLY_IMPLEMENTED | Eight dimensions/six semantic classes, citation identity, exact-revision binding, abstract-only labeling and independent reviewer checks covered by tests | Two expert reviewers and adjudication absent; no scientific approval claimed |
| Academic/research proposal | PARTIALLY_IMPLEMENTED | Project-linked sources, typed source-grounded claims, non-AI bibliography, cancellation/errors, edit-preserving project checkpoint and Markdown export tested | Hosted research-question-to-proposal journey and scientific reviewer acceptance not executed |
| Grant proposal/call constraints | PARTIALLY_IMPLEMENTED | Official-call excerpts retain page/line/section provenance; missing/inferred/conflicting requirements require researcher confirmation; budget quotes checked; edits preserved; DOCX package inspected in unit test | No live call comparison or hosted complete proposal journey; funder constraints must still be checked by a researcher |
| Research discovery through final proposals | PARTIALLY_IMPLEMENTED | EXACT-HEAD Product Quality passed; full local `npm run check` passed; local Supabase acceptance covered project persistence, owner isolation, EYRA snapshot/run API and workspace JSON export. Existing fixture tests cover discovery, evidence, methodology, review protocol, gap analysis, proposal checkpoints and scientific/grant constraints; these are software checks, not scientific validation | NOT RUN as one authenticated browser journey: isolated staging/provider access unavailable; require a human evidence/provenance and scientific review |
| BibTeX and RIS exports | PARTIALLY_IMPLEMENTED | Exact filtered/project-linked browser flows exist in `tests/e2e-library-context.mjs`; direct format tests passed (16 citation tests), including DOI/URL safety, author separation, escaping and 500-record boundaries. Browser execution blocked here by missing Playwright Chromium | NOT RUN in a live authenticated browser; no claim that provider metadata or citation support is independently verified |
| PDF and DOCX exports | PARTIALLY_IMPLEMENTED | Full local suite passed; grant-proposal test generates a real DOCX Blob, unzips its Office package and inspects actual `word/document.xml`; generated PDF input is parsed with page provenance in `grant-call-document.test.mjs` (3 focused tests passed). Pitch-deck PDF button has no local browser download acceptance | NOT RUN for final researcher-facing download/reopen/browser acceptance; inspect a PDF and DOCX from the complete staged research journey |
| Stripe subscriptions and entitlements | PARTIALLY_IMPLEMENTED | Deterministic tests in repository; live billing capability remains false | BLOCKED: authorized Stripe test-mode setup; live billing remains disabled |
| Frontend routes and interactive controls | PARTIALLY_IMPLEMENTED | Exact-head Product Quality passed; local full unit/integration suite passed (1,363/1,363); local build passed. `test:e2e:library`, `test:e2e:learning`, and `test:e2e:eyra-stream` were attempted with system Chromium and could not launch because `/usr/bin/chromium` delegates to missing `/usr/lib/chromium/chromium`; bundled Playwright Chromium is absent | BLOCKED by browser runtime and isolated staging; no control-by-control browser pass claimed |
| Accessibility and English/Greek localization | PARTIALLY_IMPLEMENTED | Source tests and full product suite passed; accessibility test coverage includes keyboard focus/skip-link and mobile navigation contracts; citation outputs preserve Greek/Unicode in fixture coverage | HUMAN_REVIEW_REQUIRED: actual screen reader, keyboard, viewport, and side-by-side English/Greek acceptance not executed |
| Monitoring, backup and recovery | PARTIALLY_IMPLEMENTED | Operational runbooks/source checks only | BLOCKED: owner confirmation of backup retention, restore exercise, alerts and support routing |
| Production release | BLOCKED | Exact-head candidate CI passed | RELEASE_APPROVED: NO; production deployment/migration requires separate authorization and release gates |

### Open feature branches not included in PR #640

| Pull request | Current review state | Evidence / required action |
|---|---|---|
| #627 Scientific quality and grant provenance | OPEN, mergeable=false; 73 commits behind current main | Its exact old-head Build, Quality Gate and Product Quality passed, but current-main integration has not been reviewed. Rebase onto current main, resolve conflicts, inspect the scientific/provenance changes against current schema, then rerun exact-head checks. |
| #604, #616, #620, #628 | OPEN, based on older main and overlapping #627 paths | Do not merge independently. Compare their unique hunks against rebased #627, preserve only verified differences, then close duplicates after consolidation. |
| #621 Grant Proposal workflow | OPEN, stale base; Product Quality failed | Determine the failed assertion on its exact head, rebase only if its Research Proposal workflow remains unique, and rerun. |
| #619 Career feed; #602 landing browser check | OPEN and divergent from current main | Rebase only if still supported product scope; otherwise close as stale. |

These branches are not part of the #640 candidate, so their functionality is not counted as release-ready here.

**Release decision: NO-GO.** The production deployment remains at main SHA `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace`; its Supabase project is missing the 16 application tables listed above. No production migration, merge, deployment, AI request, live billing action, purchase or change to the unrelated `job` project occurred.

**Owner actions:** provide an isolated free-capacity Supabase organization/project (the connected Free organization is at its two-project cap); configure preview to that isolated project; complete hosted two-account/provider/EYRA/export/deletion acceptance; establish and verify production backup/restore and approve the forward-only migration rollout; configure authorized OpenAI/Stripe test-mode access; enable main protection with required independent review and checks; obtain human scientific, accessibility, privacy/legal and pilot sign-off. Paid infrastructure and production changes remain unauthorized.

Historical rows below retain prior evidence; current status above supersedes stale checkpoints.

### Exact-head local acceptance execution — 28 November 2026

| Workflow / artifact | Result | Executed evidence and boundary |
|---|---|---|
| Exact-head CI | PASS | Four GitHub Actions runs for `993df372b98b0ccda860feed633e5a4e9143a3ed`: Build `46170258150`, EYLO Quality Gate `46170258155`, disposable Supabase/PostgreSQL `46170258093`, Product Quality `46170258086`. The disposable full-stack details above establish local synthetic-account acceptance only. |
| Local check | PASS | `npm run check`: imports, TypeScript checks, ESLint, all 1,363 tests, Vite production build and chunk-budget check completed successfully. Build emitted existing third-party annotation, mixed-import, and chunk-size advisory warnings; no failed check. |
| Migration reconciliation | PASS WITH REVIEW RISKS | `npm run db:reconcile-manifest`: valid; 40 local migration files, 7 pending against recorded history, 18 exact SQL matches, 1 known divergence. `npm run db:review-plan`: local plan valid, 34 selected / 6 excluded, no plan errors; four legacy history/timestamp warnings remain. No remote application authorized or attempted. |
| Citation/document artifacts | PASS, PARTIAL SCOPE | `node --test tests/citation-export.test.mjs tests/grant-call-document.test.mjs`: 19/19 pass. Existing proposal test creates a DOCX and checks actual package XML. This does not establish all user-facing PDF/DOCX exports or browser download acceptance. |
| Browser E2E attempts | BLOCKED BY ENVIRONMENT | `test:e2e:library`, `test:e2e:learning`, and `test:e2e:eyra-stream` attempted; all blocked before test execution because Playwright Chromium is not installed and `/usr/bin/chromium` points at a missing `/usr/lib/chromium/chromium`. This is not a product test failure or pass. |
| Hosted staging, real provider, Stripe test mode, backup/restore | NOT RUN | No isolated Supabase capacity, authorized provider key, Stripe test-mode credentials, or approved backup target is available in this workspace. Production was not queried or modified in this execution. |
| Competitor workflow benchmark | DOCUMENTED WORKFLOWS REVIEWED; SAME-TASK EXECUTION NOT RUN | Official docs were reviewed for Elicit's question→search→screen→extract→report flow ([systematic reviews](https://support.elicit.com/en/articles/14759154-systematic-reviews-in-elicit)); Consensus claims/evidence table, gaps and citation workflows ([Deep Review](https://help.consensus.app/en/articles/11740827-how-to-use-deep-review)); Scite's contextual supporting/contrasting/mention labels ([Smart Citations](https://scite.ai/features)); SciSpace search→PDF passage→comparison matrix→synthesis→DOI verification ([literature workflow](https://learn.scispace.com/use-cases/literature-review)); NotebookLM source-grounded answers with source citations ([Google help](https://support.google.com/gemininotebook/answer/16179559)); and Proposia past project + call→aligned cited draft ([product documentation](https://proposia.ai/documentation)). These are vendor-described workflows, not independently observed outcomes. Reproducible comparison still requires running the same synthetic question and same accessible source packet in all products and EYLO, recording task steps, sourced claim support, partial coverage, uncertainty, edits and export artifacts. Do not claim superiority. |
## Full local Supabase acceptance continuation — 28 November 2026

| Checkpoint | State | Evidence and limit |
|---|---|---|
| Current integrated baseline | VERIFIED | PR #634 merged at `3226ec1aca64de92d846fc7bae600b058b10a6ff`, followed by PR #637 at `3e44c64` and the Auth key-read assertion correction at `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace`; these were repository-owner actions. This task did not merge or deploy them. PR #633, #635 and #636 are closed as superseded; PR #638's provider-cooldown change is consolidated into draft #640. PR #634 is merged. |
| Local runtime availability | UNAVAILABLE | This workspace has no Docker, Podman, or Supabase CLI binary. No paid Supabase project or hosted staging is permitted. |
| Full Supabase CI stack | IMPLEMENTED; EXACT-HEAD CI PASSED | Added a GitHub Actions job using Supabase CLI 3.4.0 and the complete default local stack with no services excluded. It creates an unlinked project under `RUNNER_TEMP`, SHA-verifies the canonical migration replay, and uses unique synthetic migration version labels to retain reviewed order while covering duplicate historical timestamps. Six hazardous legacy migrations remain excluded from clean canonical replay and separately require historical-schema compatibility review. |
| Local-only network boundary | IMPLEMENTED; JOB VALIDATION PENDING | The job supplies no remote ref/token/database password. The endpoint exporter accepts loopback only and masks generated local keys/DB connection string before later Actions steps can display environment values. The acceptance harness blocks all non-local fetches and rewrites only the fake staging hostname to loopback so the unchanged staging-guarded deletion API is tested against local services. |
| Real two-account Auth/PostgREST/Storage acceptance | EXACT-HEAD FULL STACK PASSED | The exact Supabase run `46163438978` passed local Auth signup/session recovery, 17 required table access, projects, token audit, EYRA snapshot persistence, two-user RLS, real Storage upload/download isolation and complete owner-scoped export; it then failed account deletion. Sanitized database logs show `supabase_auth_admin` was denied on `study_flashcard_decks`, despite narrow cascade grants. Root cause: project-delete unlink triggers performed redundant `UPDATE` statements as the Auth role. The new pending migration skips those four updates only when `current_user = 'supabase_auth_admin'`; ordinary owner-driven project deletion still unlinks linked records. The acceptance harness now tests both behaviors using synthetic project-linked flashcard decks. No hosted migration was applied. |
| Missing hosted token audit table | SOURCE REPAIR IMPLEMENTED; LOCAL REPLAY PENDING | Added a forward-only owner-scoped `eylo_api_token_events` migration. A trigger records token creation/revocation without secrets or hashes; authenticated clients can read only their events and cannot create, update or delete events. The collection is included in workspace export and account deletion follows its Auth foreign-key cascade. The 13 foreign-key indexes remain intact; no unused index was removed. |
| Distributed scholarly provider controls | SOURCE REPAIR IMPLEMENTED; MULTI-INSTANCE REPLAY PENDING | Added PostgreSQL-backed provider pacing/concurrency leases, duplicate in-flight query coalescing by opaque cache key, Retry-After cooldown state, three-failure circuit cooldown, shared successful-result cache with TTLs and bounded cleanup. Vercel discovery requires shared coordination before calling a provider; a coordination outage fails closed, and provider HTTP 429s are never retried unless existing bounded Retry-After rules allow it. The full-stack harness issues concurrent calls from eight independent clients to test atomic quotas, single-slot leasing, duplicate suppression and cache expiry. Exact-head CI exposed a pre-lock timestamp race that misclassified waiting calls; the timestamp is now sampled after the provider-row lock and a regression assertion was added. No live provider credentials or test calls were used. |
| Local source checks | PASS; EXACT-HEAD CI PENDING | `npm run check` passed: imports, both TypeScript projects, lint, 1,361/1,361 Node tests, production build and chunk ceiling. Targeted migration/reconciliation tests pass (15/15); `npm run db:review-plan` verifies 34 selected / six excluded local-only replay migrations; `npm run db:reconcile-manifest` verifies 40 files (33 observed baseline + seven pending) and 19 historical SQL fingerprints (18 exact, one known divergence). This workspace has no Docker/Supabase CLI, so the real stack acceptance must run in GitHub Actions. |
| Disposable PostgreSQL compatibility | FIXED IN CURRENT CANDIDATE; RERUN PENDING | The quality-gate run revealed that the curated restoration copy of `complete-products-postgres.sql` still contained three token-event assertions even though the local checkout had moved those assertions to the canonical-only fixture. The historical restoration test now removes only those three assertions; token creation and authorization checks remain, and canonical replay still verifies event persistence, owner isolation, write denial and Auth cascade. |
| Latest exact-head full-stack result | DELETION REACHED; DATABASE CLEANUP CHECKER FIXED LOCALLY; RERUN PENDING | Candidate `ee1ad6b7d6cee92b60e8cd00f72b597cd7e0da94` started the complete local stack, applied the reviewed migrations and passed Auth privilege assertions. Real two-account Auth, PostgREST, Storage, RLS, persistence and export flows ran through the account deletion endpoint; account deletion re…5119 tokens truncated…E2E remain unverified. |
| Exact-head hosted checks | PARTIAL PASS | Product Quality run `46143802155` and EYRA disposable-PostgreSQL preflight run `46143802101` both completed successfully on source head `ac0d87895f4b166e23f1ef84a4880b247ab9cf47`. Vercel preview `dpl_2NmAKkzAV2eAQNHun9Yh1CbKZHoX` is READY but protected by SSO. These checks do not establish authenticated hosted acceptance, staging acceptance, or release readiness. |

No application code, production deployment, credentials, hosted database, billing, or user data were changed by this execution update.

### 28 November live schema recheck and forward-only policy correction

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Supabase project and migration identity | VERIFIED READ-ONLY | Connected Supabase metadata identifies `eyloai` project `kbzjngpzxpniaumlupaa` as `ACTIVE_HEALTHY`, PostgreSQL `17.11.0.003`. Its 19 applied migration versions match the reconciliation snapshot. The only listed development branch remains `MIGRATIONS_FAILED`; it is not an accepted disposable target. |
| Live lesson-progress policy | DEFECT CONFIRMED; NO BYPASS ESTABLISHED | Direct `pg_policy` inspection confirms the policy `WITH CHECK` contains `l.course_id = l.course_id` because the unqualified name resolves to the inner `learning_lessons` row. The validated composite FK `(lesson_id, course_id, user_id)` still enforces lesson/course/user consistency. This is a redundant and misleading policy predicate, not evidence of cross-account access. |
| Forward-only correction | IMPLEMENTED IN SOURCE; DATABASE VALIDATION BLOCKED | Added `20261128122000_learning_lesson_progress_policy_qualification.sql`, which explicitly compares `l.course_id` with `learning_lesson_progress.course_id`, plus a catalog assertion in the disposable-PostgreSQL regression. It is marked pending and not applied to the observed project. Actual PostgreSQL validation still requires the CI disposable database runner or an approved isolated database. |
| Live security/performance advisors | OPEN FINDINGS | Security advisor still reports leaked-password protection disabled (WARN) and the RLS-enabled service-only discovery rate-limit table with no client policy (INFO). Performance advisor reports 13 unindexed foreign keys and 39 unused indexes; the unused-index advisory alone does not justify removal. |
| Updated local migration plan | PASS LOCALLY; REMOTE BLOCKED | `npm run db:reconcile-manifest` verifies 34 files as 33 files at observation plus one SHA-pinned pending migration; historical SQL remains 18 exact matches and one known divergence. `npm run db:review-plan` passes with 27 local replay migrations and seven exclusions, while remote history/application remain explicitly false. |

Production remains NO-GO. No production migration, policy, Auth setting, data, or billing state was changed.

### 28 November policy-correction batch — local verification

- Added a forward-only RLS policy migration that qualifies the outer `learning_lesson_progress.course_id`; added a catalog regression to the disposable PostgreSQL learning integration and source/manifest regressions.
- `npm run check` passed locally after the change: imports, both TypeScript projects, ESLint, **1,344 tests**, Vite build and configured chunk budget. Build warnings remain for existing optional chunks and Rollup import splitting.
- `npm run db:reconcile-manifest` passes with 34 local migration files: the 33-file observed baseline plus one SHA-pinned pending migration; no new migration is counted as applied remotely.
- `npm run db:review-plan` passes with 27 disposable local replay migrations and seven exclusions. It still reports remote history unverified and remote application unauthorized.
- The disposable PostgreSQL regression was not runnable locally (`docker`, `podman`, `psql`, `postgres`, and `initdb` are absent). GitHub preflight run `46143802101` subsequently validated migrations and negative RLS/grant controls on exact source head `ac0d87895f4b166e23f1ef84a4880b247ab9cf47` in disposable PostgreSQL; no staging or production migration was applied.
- The release-readiness decision remains **NO-GO**. Exact-head Product Quality and disposable PostgreSQL preflight passed; the READY Vercel preview is SSO-protected, and hosted staging/two-account acceptance remains outstanding.

| Workstream | State | Evidence and next action |
|---|---|---|
| PR #630 independent source review | REVIEWED; no merge recommendation | Inspected all 17 changed files, grant provenance and budget checks, scientific evaluation/review semantics, release manifest gates, staging safeguards and save/export flows. No source-level defect was confirmed in this patch. Scientific scoring remains explicitly non-automated; no scientific correctness or hosted acceptance is inferred from CI. PR #630 remains open and unmerged. |
| Migration reconciliation | SNAPSHOT IMPLEMENTED; hosted repair BLOCKED | Commit `0b403063a3989ba5d5ee3575557ea0c2ddc916ac` (PR #631). Added a read-only SQL catalog recipe and snapshot manifest, plus a verifier that checks all 33 local migration files, 19 historic SQL fingerprints, version inventory and fail-closed release state. `npm run db:reconcile-manifest` PASS: 18 exact, one known divergence. No disposable local PostgreSQL executable/container exists; hosted branch is migration-failed. Owner must provide isolated disposable PostgreSQL/Supabase and migration-history/backup evidence before candidate SQL can be safely validated. |
| RLS and Storage review | PARTIALLY REVIEWED; HOSTED TWO-ACCOUNT TEST BLOCKED | Production catalog snapshot: all 34 public tables have RLS enabled. `discovery_rate_limits` has no client policy and is marked service-only; private `eylo-files` bucket has owner read/insert/delete policies consistent with immutable unique-path uploads (`upsert:false`). Found a tautological `learning_lesson_progress` policy predicate (`l.course_id = l.course_id`); its validated composite FK currently enforces the intended lesson/course/user pairing, so no cross-owner bypass is established. Add a forward-only qualified-policy migration and local PostgreSQL regression before applying. Security advisor reports leaked-password protection disabled; performance advisor reports 13 unindexed foreign keys. Owner must enable leaked-password protection and supply disposable PostgreSQL plus two authenticated staging accounts for read/write/delete/storage/cache tests. |
| Local verification | AUTOMATED_TESTS_PASSED | Clean `npm ci`, then `npm run check`: 1,342 tests passed; imports, typecheck, lint, build and chunk budget passed. `npm run db:reconcile-manifest` passed. Browser learning E2E was attempted and BLOCKED: Playwright's pinned Chromium binary is absent; `/usr/bin/chromium` is a wrapper whose `/usr/lib/chromium/chromium` target is missing. |
| OpenAI and Stripe readiness | BLOCKED; NO LIVE CALLS | `npm run config:check` reports absent Supabase/OpenAI credentials and Stripe secret, webhook secret and price IDs; no secret values were printed. No provider calls or Stripe requests were made. Owner must configure preview-only keys and test-mode Stripe identifiers, then authorize bounded acceptance within a cost cap. |
| Staging and database tests | BLOCKED | `npm run db:review-plan` confirms a local-only plan with no plan issues, but 26 candidate migrations and seven exclusions do not establish remote history or replay safety. No staging migration, production mutation, account creation, deletion fixture, paid infrastructure or live payment was used. |

Production remains **NO-GO**. The local SQL catalog recipe is descriptive and read-only; its results are a dated snapshot and must be rerun on an owner-authorized isolated target before operational acceptance.

This file is the current execution index. It does not promote a feature to staging or production verified. The canonical feature-by-feature inventory is [PRODUCT_IMPLEMENTATION_TRACKER.md](PRODUCT_IMPLEMENTATION_TRACKER.md): it contains 77 individually numbered existing product modules, their implementation descriptions, tests and remaining acceptance. All 77 are currently marked **PARTIAL**. The route-level inventory and audit is [FULL_SITE_FUNCTIONAL_AUDIT.md](FULL_SITE_FUNCTIONAL_AUDIT.md). Preserve those detailed inventories rather than maintaining a second, divergent copy here.

## 28 November integration checkpoint

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Current repository and deployment | VERIFIED | `main` is `20da2b2943479909de75c8b8ad5ccdd1fdfb31c3`. Vercel production deployment `dpl_B9dSu4itqxXuajZhHUjkWhxQEdEz` is READY and reports the same source SHA. This proves deployment identity, not end-to-end feature behavior. |
| PR #627 | INTEGRATED LOCALLY | Exact head `7c2243f56577ed7cff3a8525373389283b5427b6`; Build, EYLO Quality Gate and Product quality passed. Integration conflicts in `scientific-evaluation.mjs` and `ProjectDetail.jsx` were resolved by retaining both the existing evaluation panel and the new claim-level review. |
| PR #628 | INTEGRATED LOCALLY; EXACT-HEAD CI INCOMPLETE | Exact head `702ff379f7f262909651149cafd9adae57f1b256`; Product quality and Vercel preview checks passed, but Build and EYLO Quality Gate were not present on that exact head. Its grant changes overlapped #627, so the integration retains line-level provenance and adds the confirmed no-milestones/timeline rule, exact budget quote checks, and Markdown/DOCX enforcement. |
| PR #629 | INTEGRATED LOCALLY | Exact head `29c6dcb2155cddfded94ba8589b41ae702e94d70`; Build, EYLO Quality Gate and Product quality passed. Its manifest remains specifically a frozen historical record for #626, not evidence for this newer candidate. |
| Baseline local checks | PASS | `npm ci` installed 618 locked packages. `npm run check` passed on the unmodified `main`: imports, both TypeScript projects, ESLint, 1,326 tests and Vite build/bundle budget. This is local baseline evidence only. |
| Candidate local checks | PASS LOCALLY | On the integrated worktree, `npm run check` passed imports, both TypeScript projects, ESLint, all 1,340 tests and the production build/bundle budget. One merged grant-provenance fixture exposed missing fallback line numbers; validation now uses the same non-empty line positions as extraction. The check is local evidence, not exact-head hosted CI. |
| Release gate | NO-GO | The readiness gate requires exact-commit CI evidence and hosted staging, privacy, UX, operations, and human/legal acceptance. Local success does not satisfy those gates. |

No production settings, data, migrations, billing, credentials, or deployment were changed. No PR was merged to `main` by this checkpoint.

## 25 November research output execution

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| PR #604 review | REVIEWED; SYNCHRONIZED; still draft | Verified stale-history cancellation, transcript reset guards, UUID write receipts, safe tool errors, regression coverage, and the responsive EYRA entry point. Synchronized after PR #607 with current main `b5cbc7522a9bc1884138b6aa94e6ff26d549c1b7`; merge commit `76c10b18e37c246e4f1d4b3e32edb00de4cd2630`. Exact pre-sync head `7be312a40813c0b8ae6395cf69d328dc90638159` had successful Build, EYLO Quality Gate, and Product quality workflows; new synchronized-head results must be checked separately. No merge or deployment performed. |
| Evidence Matrix Studio | IMPLEMENTED LOCALLY | Project Evidence now supports an entered research question, real scholarly-index retrieval, adding source records to the private project Library, selecting only project-linked records, EYRA structured analysis of those records, editable AI draft fields kept separate from researcher notes, verified source links, CSV export, and explicit project save/reopen. Matrix JSON is written using the existing owner-scoped, version-checked Project API; this does not establish hosted RLS acceptance. |
| Scientific integrity and accessibility tests | PASS LOCALLY | New tests cover selected-source prompt scope, rejection of fabricated/duplicate/missing source IDs and malformed rows, citation/link provenance in CSV, and spreadsheet formula escaping. Source-level accessibility tests cover labels, status/error announcements, safe links, responsive classes, and native keyboard-operable controls. |
| `npm run check` | PASS LOCALLY | Imports, both TypeScript projects, ESLint, all Node tests, production build, and bundle budget passed for the local working tree. It is not hosted CI evidence. |
| Browser E2E | BLOCKED BY EXECUTION ENVIRONMENT | The learning-browser E2E now includes search → project link → EYRA analysis → editable matrix save/reopen → CSV export at a 390px viewport. It could not launch because Playwright's Chromium executable is missing. The fixture test is not a hosted-browser or two-user RLS result. |
| `npm run release:readiness` | NO-GO | Readiness checks remain blocked on exact-commit CI evidence and the hosted staging/privacy/UX/operations/owner-review evidence. This workflow is not release authorization. |

### Required release blockers

- Isolated Supabase staging and migration-history reconciliation.
- Auth, persistence, and two-user RLS verification on staging; local fixtures do not prove hosted authorization.
- Storage security and cross-user access verification.
- Authenticated real-provider EYRA acceptance and scientific review of generated analyses.
- Stripe test-mode billing lifecycle verification.
- Owner approval after reviewing exact-commit hosted evidence.

Production remains **NO-GO**. No live data, billing state, database, staging migration, or production deployment was changed in this execution.

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
