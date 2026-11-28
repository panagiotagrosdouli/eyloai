Warning: truncated output (original token count: 20516)
Total output lines: 366

# EYLO total execution tracker

**Updated:** 28 November 2026 (Europe/Athens)

**Repository baseline:** `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace` (main after PR #637; repository-owner merges only)

**Working branch:** `codex/eylo-tracker-recovery-20261128` (PR #641 root-cause investigation and discovery-failure repair; no production schema or data mutation)

## Current production and staging evidence — 28 November 2026

| Checkpoint | State | Evidence and limit |
|---|---|---|
| Production deployment | READY AFTER EXTERNAL MERGE; SEARCH BROKEN; RELEASE NO-GO | After PR #640 was merged remotely, Vercel created production deployment `dpl_2g4yE6XtaDUC3ju3PNdnEMp2VLVX` at main SHA `84dac94257c879a7afa79fab8b8289aca7e6317f`; it reports READY. The merge/deployment were not initiated by this task. Read-only runtime and catalog diagnostics now confirm discovery stops at an absent provider-cache RPC before any source is contacted. No authenticated product acceptance was performed against it. |
| PR preview deployment | READY at current recorded head | Vercel deployment `dpl_549EYYL3qkMQvFxBLW8HY5HyWy7g` is READY for `20fde1931c24f54576fd2b631896068f3da738f7`. The preceding `993df372` preview lookup was affected by a build-rate-limit error; the later exact-head deployment completed without quota bypass, plan change, or purchase. |
| Production Supabase | BLOCKED BY MISSING MIGRATIONS | Read-only inventory confirms 19 applied migration versions and 34 public tables, all listed with RLS. Missing: eyra_conversations, eyra_messages, eyra_agent_runs, eyra_agent_actions, grant_applications, meeting_participants, eylo_directory, eylo_teams, eylo_team_invites, eylo_team_members, eylo_connections, eylo_community_posts, eylo_peer_reviews, eylo_feedback, eylo_api_tokens, eylo_api_token_events. The discovery coordination migration `20261128145000_scholarly_provider_coordination.sql` is also absent from live migration history; its three tables and four RPCs are missing. No migration was applied.
| Billing and AI capability | OBSERVED | Production `/api/capabilities` returns `ai=true` and `billing=false`; billing remains disabled. Missing database tables still make durable EYRA persistence unavailable. |
| Hosted staging | BLOCKED BY FREE PROJECT CAP | Supabase rejected the authorized `eyloai-staging` create request in `panagiotagrosdouli's Org` / eu-north-1 at the Free two-project limit. `eyloai` is active; unrelated `job` remains inactive and untouched. Owner action: Supabase Dashboard → organization → Projects → New project in an isolated free-capacity organization/provider, or separately authorize paid capacity. No purchase is authorized. |
| Consolidated acceptance candidate | MERGED INTO MAIN; PRODUCTION RELEASE NO-GO | PR #640 was merged remotely at 2026-11-28 17:53:51 UTC as merge commit `84dac94257c879a7afa79fab8b8289aca7e6317f`, after its exact-head checks passed. This task did not merge it. Main Build `46172914752` and Product Quality `46172914792` passed on the merge commit; GitHub Pages deploy run `46172914645` passed. Vercel then produced the READY production deployment above. Hosted acceptance and release approval remain blocked. |
| Post-merge research follow-up | LOCAL CHECK PASS; EXACT-HEAD CI/PREVIEW PENDING | The implementation is on the existing development branch (code-tree commit `04b670bd2c7569eca122643eb7f65815a2116ebc`). Local `npm run check` passed on the implementation tree (1,364 tests). GitHub Actions has no run for the post-merge implementation or tracker commits, and Vercel has no deployment for the implementation SHA. No new PR was opened. |

## Final consolidation verification — 28 November 2026

**Reviewed PR #640 head:** `20fde1931c24f54576fd2b631896068f3da738f7`, base `a12533fa4c39405cdbbaf245455ab0e2bbbd7ace`. The PR was merged remotely at `2026-11-28T17:53:51Z` as `84dac94257c879a7afa79fab8b8289aca7e6317f` while this work was underway; this task did not merge it. Exact short commit `7cfa6368` could not be found in the available local or fetched remote Git objects; work continued from the latest remote branch and no remote work was overwritten. PR #638's shared provider cooldown fix was included and #638 is closed as superseded. #633, #635 and #636 are closed as superseded; #634 is merged.

**PR #640 exact-head GitHub checks: PASS** — Build run `46172142173`; EYLO Quality Gate `46172142196`; disposable PostgreSQL/Supabase acceptance `46172142165`; Product Quality `46172142188`. All four completed successfully for exact head `20fde1931c24f54576fd2b631896068f3da738f7`. Current post-merge follow-up SHA `04b670bd2c7569eca122643eb7f65815a2116ebc` has no Actions run and no Vercel deployment record, so the new grant-context change remains locally verified only.

The disposable stack replayed the reviewed migration order and verified privileges; its `full-local-supabase-acceptance` job and each substantive step completed successfully. It exercised real local Auth, PostgREST and Storage with two synthetic users. Logs explicitly report passing signup/login/refresh/session restoration/logout/account switching, all 17 required table accesses, project persistence and cross-account read/update/delete isolation, EYRA snapshot RPC and ordered-message persistence/isolation, the production EYRA run API's list/detail/cancel/delete and cross-account denial, real Storage upload/download and cross-account path isolation, owner-scoped workspace export, and privacy deletion that reauthenticated, removed Storage and owner data, and preserved the other account. The only skipped acceptance-job step was sanitized failure diagnostics, conditional on a failure; it is not an acceptance test. Network requests were restricted to loopback. Product Quality's job and all substantive checks completed successfully, with no product acceptance step skipped, including terminal-stream/browser auth, exports/navigation, learning flows, deterministic relevance, and source→evidence→literature-review→proposal coverage. These are CI/disposable-environment results, not hosted user acceptance or scientific validation.

### Production discovery root-cause verification — 28 November 2026 (read-only)

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Request lifecycle | ROOT CAUSE CONFIRMED | In Vercel mode the handler first calls `consume_discovery_rate_limit`, then `scholarlyProviderCoordinator.readCache`, and only then reserves a provider lease and contacts a scholarly service. Production edge logs in the 17:30–18:30 UTC window show 33 quota RPC requests returning HTTP 200 and 32 first cache-RPC requests returning HTTP 404. The request stops at this cache call, before OpenAlex, Semantic Scholar, Europe PMC, Crossref or arXiv is contacted. The 503 does not establish a source-index outage. |
| Production configuration and quota | CONFIGURED / ACCEPTING REQUESTS | Vercel production environment metadata contains `VITE_SUPABASE_URL`, a publishable-key variable, and `SUPABASE_SECRET_KEY`; no secret values were read. `public.consume_discovery_rate_limit(text,integer,integer)` exists with `EXECUTE` granted to `service_role`, and the successful edge logs prove that the production URL and service credential work for the quota operation. This excludes missing credentials and quota RPC permission as the observed cause. |
| Provider coordination RPCs/tables | ABSENT FROM PRODUCTION | `pg_proc` has no `read_scholarly_provider_cache(text)`, `reserve_scholarly_provider_slot(text,text,integer,integer,integer)`, `finish_scholarly_provider_request(text,uuid,integer,integer)`, or `write_scholarly_provider_cache(text,text,text,text,integer)`. The tables `scholarly_provider_state`, `scholarly_provider_leases`, and `scholarly_response_cache` are also absent. Thus lease, cache, and cooldown state cannot be used; the code fails closed before any upstream fetch. |
| Existing migration | SOURCE EXISTS; LIVE VERSION NOT APPLIED | `supabase/migrations/20261128145000_scholarly_provider_coordination.sql` exists on `main` and PR #641 with the same blob SHA `0a9d7a076b34ac2be77a3fc1be6422be756b9e73`. It creates three private RLS-enabled tables and four `SECURITY DEFINER` functions with empty `search_path`; it revokes function execution from `PUBLIC`, `anon`, and `authenticated`, and grants it only to `service_role`. Production’s 19-version migration list omits `20261128145000`. The Supabase development branch reports `MIGRATIONS_FAILED`. |
| Repair/reconciliation | BLOCKED; NO PRODUCTION CHANGE | First reconcile schema, backup and migration ledger on an isolated staging target; replay the existing migration there; verify exact RPC signatures, grants, reservation/cache/cooldown behavior and rollback/recovery. Only after that should an owner separately authorize production migration. The SQL is non-idempotent and must not be blindly replayed or marked applied. The connected Free org is at its two-project cap, so isolated staging is unavailable without new capacity. No duplicate migration, quota bypass or coordination fallback is appropriate. No production DDL/data write was issued. |
| Synchronized PR #641 checks | PASS ON CODE-BEARING HEAD `b0be5503ab4e1b4f8e5a13c97661867e85834ce5` | Build `46176745320`, EYLO Quality Gate `46176745376` (including disposable PostgreSQL/RLS and legacy-schema checks), and Product Quality `46176745397` all passed. Product Quality installed GitHub Chromium and passed the coordinator-attribution E2E plus the existing browser suites. The tracker-only commit follows the tested code-bearing head; no database migration files changed. Vercel preview failed with `api-deployments-free-per-day` and no deployment was produced. |
| Source results | NOT GENERATED | Since the request fails before upstream fetch, this diagnosis generated no scholarly provider results, DOI verification or citation support. |

Vercel runtime-log lookup for the one-hour window returned a Hobby-plan retention-limit error, not an empty result. The Supabase edge path/status aggregation is the direct hosted request evidence.
### Functional acceptance registry

| Feature | Source status | Automated evidence | Hosted acceptance |
|---|---|---|---|
| Database migrations and required tables | IMPLEMENTED | EXACT-HEAD CI PASS: disposable stack replay, privilege preflight and 17 table access; local `db:reconcile-manifest` valid (40 migration files, 7 pending, 18 exact SQL matches, 1 known divergence); `db:review-plan` valid (34 selected, 6 excluded, 4 history warnings) | BLOCKED: production lacks 16 application tables and the provider-coordination schema migration; migration history and legacy side effects require isolated staging reconciliation; no hosted migration applied |
| Authentication and session lifecycle | IMPLEMENTED | AUTOMATED_TESTS_PASSED: two local users, signup/login/refresh/restore/logout/relogin | BLOCKED: hosted two-account test requires isolated staging |
| Account/project isolation | IMPLEMENTED | AUTOMATED_TESTS_PASSED: read/write/delete ownership and export isolation | BLOCKED: hosted acceptance |
| Storage and privacy deletion | IMPLEMENTED | AUTOMATED_TESTS_PASSED: actual local Storage ownership, export, deletion and cleanup | BLOCKED: hosted acceptance |
| EYRA conversations and messages | PARTIALLY_IMPLEMENTED | AUTOMATED_TESTS_PASSED: durable local snapshot, ordered messages and isolation | BLOCKED: full model/tool/streaming run and hosted schema activation |
| EYRA agent run ledger API | IMPLEMENTED | AUTOMATED_TESTS_PASSED: list/detail/cancel/delete and owner isolation using live local Auth tokens | BLOCKED: hosted activation and end-to-end provider/tool execution |
| EYRA project context and research memory | PARTIALLY_IMPLEMENTED | Exact project ownership, bounded fields, permission-scoped context and canonical records covered in `eyra-workspace-context`, `eyra-retrieval-service`, conversation and Supabase acceptance tests | Semantic retrieval relevance, actual hosted model execution and restored history on isolated staging remain unverified |
| EYRA streaming, stop and recovery | PARTIALLY_IMPLEMENTED | Server stream, cancellation, timeout, partial-result rejection and safe recovery contracts pass in the full local suite; browser HTTP terminal-stream E2E attempted but blocked before execution by missing browser binary | Browser interaction and provider cancellation/recovery are not hosted-verified |
| Scholarly provider coordination | IMPLEMENTED | AUTOMATED_TESTS_PASSED: distributed leases/cache/quota and 429 Retry-After regression | BLOCKED: authorized bounded live OpenAlex/Semantic Scholar acceptance |
| Source discovery and transparent partial retrieval | PARTIALLY_IMPLEMENTED; PRODUCTION PATH FAILS BEFORE SOURCE CALLS | Product Quality fixtures cover deduplication and explicit partial/error state. Read-only production Supabase edge logs for 17:30–18:30 UTC show 33 `consume_discovery_rate_limit` calls returning 200 and 32 `read_scholarly_provider_cache` calls returning 404. Catalog inspection confirms the cache RPC and all other provider coordination tables/RPCs are absent. | Root cause is unapplied migration `20261128145000_scholarly_provider_coordination.sql`; no provider was contacted by these failed requests. No genuine source result, DOI metadata or citation evidence is verified. Fix requires isolated migration reconciliation, which is currently blocked by staging capacity and separate production migration authorization. |
| Evidence extraction and DOI identity | PARTIALLY_IMPLEMENTED | Exact excerpt verification, DOI normalization/identity, mismatch handling and correction/retraction notices covered by `evidence-verification` and `citation-verification` tests | Citation record accuracy and semantic support require source-level human review; no live-provider acceptance |
| Supporting/conflicting claims and abstract/full-text distinction | PARTIALLY_IMPLEMENTED | Claim assessment requires cited exact abstract excerpts; fabricated, unsupported and uncited verdicts fail closed; abstract-only evidence cannot imply full-text verification (`evidence-verification`, `scientific-evaluation`, project scientific review tests) | Full-text claim review and independent expert adjudication not executed |
| Research gaps, limitations and decisions | PARTIALLY_IMPLEMENTED | Research-gap candidate/context/project flows and project decision history have passing fixture/unit coverage; scientific caveats and unreviewed status are preserved | No completed human-validated gap analysis or hosted decision-history journey |
| Systematic review protocol and screening | PARTIALLY_IMPLEMENTED | `literature-review-protocol` covers question, search strategy, inclusion/exclusion, human reasons, deduplication guards, unsaved edits and JSON/CSV evidence exports; audit explicitly warns on incomplete coverage and avoids PRISMA claims | End-to-end search across databases, reviewer workflow and applicable PRISMA report not completed; not a completed systematic review |
| Methodology recommendations | PARTIALLY_IMPLEMENTED | Schema-complete proposed methods, selected-source restrictions, uncited-claim rejection, project save receipts and Markdown export covered by `research-methodology-studio` tests | No validated design recommendation or researcher sign-off; all generated methods remain proposals |
| Scientific evaluation and quality review | PARTIALLY_IMPLEMENTED | Eight dimensions/six semantic classes, citation identity, exact-revision binding, abstract-only labeling and independent reviewer checks covered by tests | Two expert reviewers and adjudication absent; no scientific approval claimed |
| Academic/research proposal | PARTIALLY_IMPLEMENTED | Project-linked sources, typed source-grounded claims, non-AI bibliography, cancellation/errors, edit-preserving project checkpoint and Markdown export tested. Grant proposal generation now carries a bounded saved EYRA question/search plan as explicitly non-evidentiary context; focused regression passes. | Hosted research-question-to-proposal journey and scientific reviewer acceptance not executed |
| Grant proposal/call constraints | PARTIALLY_IMPLEMENTED | Official-call excerpts retain page/line/section provenance; missing/inferred/conflicting requirements require researcher confirmation; budget quotes checked; edits preserved; DOCX package inspected in unit test | No live call comparison or hosted complete proposal journey; funder constraints must still be checked by a researcher |
| Research discovery through final proposals | PARTIALLY_IMPLEMENTED | PR #640 exact-head Product Quality passed for the source→evidence→literature-review→proposal fixture journey. The post-merge research follow-up adds bounded EYRA-plan context to grant drafting; local `npm run check` passed with 1,364 tests, including 43 related grant/proposal/scientific-review tests. Local Supabase acceptance covered project persistence, owner isolation, EYRA snapshot/run API and workspace JSON export. These are software checks, not scientific validation | NOT RUN as one hosted authenticated browser journey: isolated staging/provider access unavailable; require human evidence/provenance and scientific review |
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
| #627 Scientific quality and grant provenance | OPEN, mergeable=false; stale base | Reviewed against PR #640. Conflict-resolution comparison found no necessary unique code delta to bring over as a stale branch merge; its claim-review, inferred-requirement and grant invalidation behaviors are represented in #640's current tree. A new bounded EYRA-plan-to-grant-context regression was added on #640. Keep #627 unmerged until its owner closes or rebases it; exact-head #640 checks remain the acceptance evidence. |
| #604, #616, #620, #628 | OPEN, based on older main and overlapping #627 paths | Do not merge independently. Compare their unique hunks against rebased #627, preserve only verified differences, then close duplicates after consolidation. |
| #621 Grant Proposal workflow | OPEN, stale base; exact Product Quality run #2231 failed | Inspected its exact-head failure: `Verify canonical timer, quiz and learning workflows` timed out waiting for “Inspect provenance and confirm critical requirements” in `ResearchProposalBuilder`; subsequent product steps were skipped. #640's current-head Product Quality passes the complete suite and its existing grant builder has separate call-provenance validation, so do not merge this stale branch without a successful rebase and review of its added UI/engine code. |
| #619 Career feed; #602 landing browser check | OPEN and divergent from current main | Rebase only if still supported product scope; otherwise close as stale. |

These branches are not part of the #640 candidate, so their functionality is not counted as release-ready here.

**Release decision: NO-GO.** Main is at `84dac94257c879a7afa79fab8b8289aca7e6317f` and Vercel reports its production deployment READY. The merge and resulting automated deployment happened remotely and were not performed by this task. The Supabase project remains missing the 16 application tables listed above. This task applied no production migration, sent no live AI request, changed no billing, bought no infrastructure and did not touch the unrelated `job` project.

**Owner actions:** provide an isolated free-capacity Supabase organization/project (the connected Free organization is at its two-project cap); configure preview to that isolated project; complete hosted two-account/provider/EYRA/export/deletion acceptance; establish and verify production backup/restore and approve the forward-only migration rollout; configure authorized OpenAI/Stripe test-mode access; enable main protection with required independent review and checks; obtain human scientific, accessibility, privacy/legal and pilot sign-off. Paid infrastructure and production changes remain unauthorized.

Historical rows below retain prior evidence; current status above supersedes stale checkpoints.

### Exact-head local acceptance execution — 28 November 2026

| Workflow / artifact | Result | Executed evidence and boundary |
|---|---|---|
| PR #640 exact-head CI | PASS | Four GitHub Actions runs for `20fde1931c24f54576fd2b631896068f3da738f7`: Build `46172142173`, EYLO Quality Gate `46172142196`, disposable Supabase/PostgreSQL `46172142165`, Product Quality `46172142188`. The disposable full-stack details above establish local synthetic-account acceptance only. |
| Local check | PASS | After the grant-plan context change, `npm run check` passed import resolution, both TypeScript projects, ESLint, all 1,364 tests, Vite production build and chunk-budget check. Largest measured JavaScript chunk was 579.5 KiB against the 683.6 KiB ceiling. Existing third-party annotation, mixed-import and font-data advisory warnings remain non-fatal; release stamping stayed unset because the local implementation commit is not yet available to the build. |
| Migration reconciliation | PASS WITH REVIEW RISKS | `npm run db:reconcile-manifest`: valid; 40 local migration files, 7 pending against recorded history, 18 exact SQL matches, 1 known divergence. `npm run db:review-plan`: local plan valid, 34 selected / 6 excluded, no plan errors; four legacy history/timestamp warnings remain. No remote application authorized or attempted. |
| Citation/document artifacts | PASS, PARTIAL SCOPE | `node --test tests/…8516 tokens truncated…tgreSQL/Supabase and migration-history/backup evidence before candidate SQL can be safely validated. |
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


## 28 November follow-up — grant plan provenance and exact-head acceptance

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Current main and branch preservation | VERIFIED | Latest main advanced to `c795c22447ee7f15d6c46ca3d9caf8c61bd7bfa3` through PR #642. PR #643 is based on that exact main and contains only the grant prompt and regression-test changes. The reported short local SHA `7cfa6368` could not be fetched; commit `9b284b7a` is available as tracker history, while its parent integration in PR #642 already brought the saved-plan context into main. |
| Grant research-plan handoff | EXACT-HEAD CHECKS PASS | PR #643 head `c1fbfd15c509a5f7bf91f6cf2d184a43440c7795` maps the schema's canonical `open_questions` into a bounded prompt context, retains a bounded legacy-field fallback, labels plan text untrusted/non-evidentiary, and excludes arbitrary plan fields. Existing proposal validation restricts output citation IDs to confirmed selected scholarly records. |
| Build, Quality Gate and Product Quality | PASS | Exact-head Build `46176736611`, EYLO Quality Gate `46176736656`, and Product Quality `46176736634` all completed successfully on PR #643 head `c1fbfd15c509a5f7bf91f6cf2d184a43440c7795`. Product Quality's browser/product steps all passed. The change adds no SQL, so no separate migration-workflow run was triggered. No shell execution environment was available for local tests. |
| Vercel preview | BLOCKED BY FREE DAILY BUILD LIMIT | No preview deployment exists for the exact PR #643 head. Vercel returned the `api-deployments-free-per-day` limit; no retry, quota bypass, plan change or purchase was attempted. |
| Production scholarly discovery 503 | ROOT CAUSE CONFIRMED; LIVE SERVICE UNREPAIRED | Read-only production catalog/log evidence recorded above shows the coordination-cache RPCs and three tables are absent; `read_scholarly_provider_cache` returns 404 before any index provider request. Migration `20261128145000_scholarly_provider_coordination.sql` exists in main and passed disposable local replay, but is absent from production migration history and is non-idempotent. Reconcile isolated schema/history/backup and stage the migration before seeking separate production authorization; keep quota enforcement fail-closed. |
| Hosted acceptance and release | BLOCKED / NO-GO | Disposable Supabase and CI/browser checks do not establish hosted Auth, provider, EYRA, Storage, export, deletion, backup/restore, or production acceptance. No hosted or production migration/deployment, live billing, or private pilot was performed. |

## Scholarly coordination privilege acceptance — 28 November 2026

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Current main | VERIFIED | Latest fetched main is `2806e04b70c18c854ca2346f89bf3e11502cc4fb`; PR #641 was merged externally. PR #643 remains open and unchanged, preserving its grant-plan provenance and citation safeguards. The previously reported local `7cfa6368` is not needed for this recovery work. |
| Disposable coordination behavior | EXISTING REAL-STACK COVERAGE | `scripts/integration/test-local-supabase.mjs` uses eight Supabase clients against the GitHub Actions disposable stack to verify atomic lease contention, duplicate suppression, release, shared cache, expiry, and Retry-After cooldown. Local focused coordination/migration tests pass 33/33. |
| Disposable privilege/RLS assertion | IMPLEMENTED; EXACT-HEAD CI PENDING | Added direct catalog assertions to the full-stack acceptance harness: all three coordination tables must have RLS enabled, zero row policies, and no direct privileges for `anon`, `authenticated`, or `service_role`; all four `SECURITY DEFINER` RPCs must be executable only by `service_role`. The local harness passes `node --check`; this workspace has no Docker/Supabase CLI, so actual catalog assertions await the GitHub-hosted Supabase stack run. |
| Migration inventory | LOCAL VERIFICATION PASS | `npm run db:reconcile-manifest` reports 40 local migrations, 7 pending, 19 historical fingerprints checked (18 exact, one known divergence). `npm run db:review-plan` reports 34 selected / 6 excluded, no plan errors, with 4 legacy history/timestamp warnings. Remote migration execution remains unauthorized. |
| Isolated acceptance option | ZERO-ADDITIONAL-INFRASTRUCTURE, DISPOSABLE ONLY | Existing EYRA Schema Preflight runs full Supabase on a temporary GitHub Actions runner. It is not hosted staging and provides no production compatibility evidence. No isolated hosted free Supabase project is available in the connected organization; `job` remains untouched. |
| Owner migration procedure | PREPARED; NOT EXECUTED | Added [the scholarly coordination recovery runbook](release/SCHOLARLY_COORDINATION_RECOVERY_RUNBOOK.md) with current SQL hash, preconditions, abort criteria, one-migration transaction and subsequent history repair, postchecks, and data-recovery boundaries. Current decision remains NO-GO until isolated hosted staging (or an explicit owner-approved alternative), backup/restore confirmation, and separate production authorization. |
| Production/data acceptance | NOT PERFORMED | No production DDL, migration-history edit, scholarly provider call, or data mutation was performed. No real source records, DOI verification, EYRA citation acceptance, or hosted research journey can be claimed while the production RPCs are absent. |

