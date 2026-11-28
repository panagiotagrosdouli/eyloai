# EYLO total execution tracker

**Updated:** 28 November 2026 (Europe/Athens)

**Repository baseline:** `20da2b2943479909de75c8b8ad5ccdd1fdfb31c3` (main after merged PR #626)

**Working branch:** `codex/eylo-phase-ii-migration-reconciliation-20261128`

### Hosted-capacity, provider-reliability, and schema follow-up — 28 November 2026

**Current candidate:** `aa66d73945a602c3f40b3eb7f96b78464586cdaa` on PR #631. PR remains open and unmerged.

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Supabase capacity | BLOCKED; COST APPROVAL PENDING | Read-only inventory found one Free organization (`ygpcvnqrewkjjxtkyvvv`), the `eyloai` production project, and unrelated inactive `job`. Supabase rejected the authorized $0/month `eyloai-staging` create because the account/org reached the Free two-project limit. No project/branch was created and no job project was touched. Owner was asked to approve or decline Pro; no upgrade or charge has occurred. A paid branch quote is $0.01344/hour and is not selected. |
| Leaked-password protection | OWNER BILLING ACTION REQUIRED | Supabase makes this setting available on Pro and above. An organization billing owner must authorize the upgrade and then enable Auth → Settings → Password security → leaked-password protection. The security advisor and signup/password-recovery tests must be rerun afterward. No plan or Auth setting was changed. |
| Candidate schema gaps | SOURCE REPLAY PASS; HOSTED GAP OPEN | Read-only hosted catalog found 17 required tables absent: EYRA conversation/messages/runs/actions; grant applications; meeting participants; and 11 collaboration/API tables. Candidate migrations exist for several, but the hosted catalog does not contain them despite recorded history. The native meeting participant migration is in canonical disposable replay with owner/invitee RLS assertions. Staging replay/catalog comparison remains blocked. |
| Foreign-key advisories | 13 INDEX FIXES; DISPOSABLE PG PASS | Added forward-only `CREATE INDEX IF NOT EXISTS` for all 13 advisory findings with catalog assertions. CI run `46147733913` passed the disposable PostgreSQL preflight on the current candidate. No hosted migration was applied and no index was removed. |
| Unused-index advisories | PRESERVED | The 39 advisory findings were rechecked against `pg_stat_user_indexes`; `stats_reset` is null, many affected tables are empty/small, and representative workload-window evidence is unavailable. No index was removed. |
| Provider resilience | LOCAL/CANDIDATE PASS; DISTRIBUTED/LIVE NOT VERIFIED | Source enforces per-runtime provider gaps: OpenAlex 100 ms general / 1 s for >5 boolean operators; Crossref 1 s without registered contact / 334 ms with contact; Semantic Scholar 1 s; arXiv 3 s. Added equal-jitter bounded retry for transient failures and numeric/HTTP-date Retry-After normalization. Existing per-runtime single-flight, memory cache, circuit breaker and concurrency bound remain; successful responses use the shared CDN cache. Provider controls are not a globally shared upstream quota across serverless instances. No live calls or authorized keys/cost cap were available; previous production smoke returned results from 3/5 providers and OpenAlex/Semantic Scholar 429s. |
| Local candidate validation | PASS | `npm run check`: imports, both TypeScript projects, lint, 1,347/1,347 tests, production build and chunk ceiling. Build has pre-existing optional-chunk/Rollup warnings. `npm run db:reconcile-manifest`: 35 migration files, 19 historic fingerprints (18 exact, one known divergence), two pending migrations. `npm run db:review-plan`: 29 selected / six excluded, no plan errors; four legacy-history warnings remain. |
| Exact-head CI and preview | PASS | Product Quality run `46147733968` and disposable PostgreSQL preflight `46147733913` completed successfully on candidate `aa66d73945a602c3f40b3eb7f96b78464586cdaa`. Vercel check was success for this SHA. The preview is SSO-protected; no authenticated hosted acceptance was performed. The former browser-install failure on Ubuntu 26.04 was fixed by pinning this workflow job to Ubuntu 24.04. |
| Release decision | NO-GO | `npm run release:readiness` returned NO-GO on parent baseline `64f1505...`; there is still no exact-head sanitized acceptance artifact/reviewer or hosted staging evidence. `npm run config:check` confirms staging Supabase, OpenAI, Resend, and Stripe environment settings are absent in this workspace (names only; no secret values read). No staging/two-account auth, complete hosted research workflow, Stripe test lifecycle, privacy lifecycle, backup/restore, or incident evidence exists. Production remains untouched. |

**Hosted acceptance matrix**

| Feature | Source verification | Automated verification | Browser verification | Database verification | Hosted verification | Remaining blocker |
|---|---|---|---|---|---|---|
| Build, routes and core product | Candidate source review | PASS on exact SHA; 1,347 local tests | CI product journeys PASS | Disposable migration preflight PASS | Vercel preview check PASS; preview SSO blocks authenticated review | Owner-provisioned staging identity and hosted report |
| Auth and private data | Auth/RLS code paths reviewed | Auth, session, library and isolation regressions PASS | CI browser regressions PASS | Negative RLS/grant controls PASS in disposable PG | NO hosted two-account/signup/recovery/session run | Staging URL/SMTP/disposable inboxes; leaked-password protection setting |
| Schema and persistence | 29-migration local plan reviewed | Manifest/review tests and PostgreSQL preflight PASS | No hosted project journey | Disposable PostgreSQL PASS; hosted catalog has 17 required tables absent | No isolated hosted replay; migration history divergent | Separate staging + catalog/history reconciliation |
| Scholarly discovery | Provider adapters/resilience code reviewed | Retry, throttle, partial result and provenance tests PASS | Production smoke previously returned 24 papers from 3/5 providers | Client quota RPC configured; provider-wide serverless quota unverified | Candidate preview SSO; provider 429s on old production SHA | Authorized provider credentials/cost cap, global quota and live per-provider search |
| EYRA | Tool/stream/persistence source present | Terminal-stream CI checks PASS | CI stream/regression journeys PASS | Disposable SQL replay only | No authenticated live AI call, usage accounting, or persistence test | Staging plus authorized model key and cost cap |
| Full research workflow | Product flows and export code present | Related product workflow regressions PASS | Subflows covered in CI, not full requested journey | Fixture/database tests only | No register-to-restore hosted journey under either account | Staging, two disposable accounts and generated artifact verification |
| Billing and entitlements | Stripe gates and webhook source present | Source-level billing tests only | No browser checkout | No hosted entitlement ledger check | NO test-mode checkout/webhook/lifecycle run; paid features disabled | Stripe test credentials, products/price IDs, signed test webhook |
| Privacy and deletion | Export/deletion guards reviewed | Safe-path/authentication regression suite PASS | No hosted privacy journey | Disposable regression only | NO disposable-account export/delete/storage cleanup | Staging accounts, reauthentication and retained-evidence review |
| Production operations | Runbook/gates in source | Readiness gate NO-GO; config gate incomplete | Production public discovery smoke only | No backup/restore evidence | Uptime/provider alert delivery and restore not verified | Owner-configured alerting, backups, support and recovery drill |

**Owner-only staging action:** Project creation at the quoted $0/month was attempted only after the user approved that cost. Supabase rejected it at the Free two-project limit; no charge occurred. A billing owner must now approve the paid route or resolve the quota without changing the unrelated `job` project. Supabase Dashboard → Organization → Billing: Pro is $25/month and additional projects start at $10/month. At default Micro compute, two active projects (production and staging) are about $20/month; with the plan's $10 monthly compute credits the estimate is about $35/month total before overages. Confirm the final billing preview before purchase. An organization owner/billing admin must authorize the plan change; for leaked-password protection, use Auth → Settings → Password security. After staging becomes `ACTIVE_HEALTHY`, configure staging-only email delivery/disposable inboxes, reconcile migration history, replay reviewed migrations, compare tables/functions/policies/indexes, and run two-account hosted acceptance. Do not use the failed `main` branch. No production migration, live billing, or credential change is authorized.

**Highest supported launch mode:** Internal testing (level 2). External beta, paid pilot, and commercial production are not supported by current evidence.

### Exact-head CI and preview follow-up — 28 November 2026

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Source revision | VERIFIED | Policy-correction source head: `ac0d87895f4b166e23f1ef84a4880b247ab9cf47` on PR #631. |
| Product Quality | PASS | GitHub Actions run `46143802155` completed successfully on that exact source head, including product workflow/browser suites and discovery gateway/partial retrieval coverage. |
| EYRA PostgreSQL preflight | PASS IN DISPOSABLE CI DATABASE | GitHub Actions run `46143802101` completed successfully on that exact source head; it executed migrations and negative RLS/grant controls in a disposable PostgreSQL instance. It is not staging or production validation. |
| Vercel preview | READY; ACCESS RESTRICTED | Preview deployment `dpl_2NmAKkzAV2eAQNHun9Yh1CbKZHoX` was built from the same source head. Vercel SSO protected the preview, so authenticated hosted acceptance was not performed. |
| Release gate | NO-GO | Re-run of `npm run release:readiness` at the exact source head recorded `NO-GO`. Staging identity, two-account hosted auth/isolation, privacy deletion, operations, and human/legal evidence remain unrecorded. |

The local `npm run check` remains PASS (1,344 tests; typecheck, lint, build and bundle budget). Production remains on `main` SHA `20da2b2943479909de75c8b8ad5ccdd1fdfb31c3`; no production or database settings were changed. Discovery on production returned 24 papers from three of five indexes; OpenAlex and Semantic Scholar reported HTTP 429 and the UI disclosed partial retrieval. The current exact-head checks validate the policy correction in CI, but do not establish hosted acceptance or release authorization.


**Revalidated candidate:** PR #630 exact head `8983a3c774c9a24b1859eaa0a5cd0f7d3a8e02bb` (ready for review; not merged). Exact-head Build run `46138731826`, EYLO Quality Gate `46138731804`, Product quality `46138731812` and Vercel preview `dpl_CWoEDK2jCDtXiTapGyfkc9pRD7ra` passed. Local `npm run check` passed on this SHA after a clean `npm ci`: imports, both TypeScript projects, ESLint, 1,340 Node tests, Vite build and chunk budget. This is source/CI evidence only; production remains NO-GO.

**Live migration reconciliation:** Read-only inventory on 2026-11-28 reconfirmed 19 applied migration versions, 34 public tables with RLS enabled, 18 exact historical SQL fingerprints and one known divergent `security_hardening` fingerprint from the 2026-11-20 statement snapshot. The reproducible snapshot and local verification are [supabase-reconciliation-2026-11-28.json](release/supabase-reconciliation-2026-11-28.json) and `npm run db:reconcile-manifest`. Missing EYRA conversation/run tables, grant applications, meeting participants and ten collaboration/product tables remain. The available Supabase branch reports `MIGRATIONS_FAILED`; no disposable local PostgreSQL runtime is installed and no staging migrations were applied. Production and the unrelated inactive job project were untouched.

## 28 November Phase II continuation

### Execution update — exact PR #631 head `a860247d0c1cf03bfaf03ac0eb3608fbec3df642`

| Checkpoint | Result | Evidence and limit |
|---|---|---|
| Clean local install and quality suite | PASS | In a fresh shallow checkout of `codex/eylo-phase-ii-migration-reconciliation-20261128`, `npm ci` installed the lockfile's 618 packages and `npm run check` exited 0: local imports, both TypeScript projects, ESLint, the complete Node test suite, Vite production build and configured bundle ceiling passed on the exact PR head. The build emitted its expected advisory for large optional chunks; no source files were changed during this run. |
| Migration snapshot and local plan | PASS LOCALLY; REMOTE BLOCKED | `npm run db:reconcile-manifest` verified 33 migration files and 19 historical SQL fingerprints (18 exact, one recorded divergence). `npm run db:review-plan` verified a local-only plan with 26 selected and seven excluded migrations, but explicitly reports `remote_application_authorized=false` and `remote_history_verified=false`; legacy timestamp/history hazards remain. No migration was applied. |
| Release readiness and configuration | NO-GO / INCOMPLETE | `npm run release:readiness` returned `NO-GO` for this exact SHA, with production unauthorized and hosted identity, staging, preview, privacy, UX, operations and human review evidence missing. `npm run config:check` reports required server/provider settings absent in this local environment; it printed no secret values and made no network requests. |
| Current production identity | VERIFIED | Vercel deployment `dpl_B9dSu4itqxXuajZhHUjkWhxQEdEz` and public `/release.json` both identify production `main` at `20da2b2943479909de75c8b8ad5ccdd1fdfb31c3`. This production SHA differs from PR #631; hosted observations below are not acceptance of the PR candidate. |
| Public discovery browser journey | PARTIALLY BROWSER-VERIFIED ON PRODUCTION | On `https://eyloai.vercel.app/discover`, the homepage preview tabs switched between Discover and EYRA, and the Climate change adaptation example opened a real source-linked search. The page returned 24 deduplicated papers from three of five indexes, four institutions and no researcher profiles. It explicitly identified OpenAlex and Semantic Scholar HTTP 429 rate limits and exposed partial retrieval; this is a transparent external-provider limitation, not a verified search defect. Search retry, export, save, authentication and protected workflows were not exercised. |
| Local Playwright browser | BLOCKED; alternatives investigated | `npx playwright install chromium` was attempted from the official Playwright installer but its CDN returned HTTP 403 `Site Unavailable` on all retries. `/usr/bin/chromium` exists as a wrapper, but no runnable Chromium binary is installed. The hosted public journey was still exercised in the cloud browser; local Chromium and database-backed browser E2E remain unverified. |
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
