# EYLO integration decisions — 2026-11-12

Baseline: `7bf956a72d42f251c77cde7276dcb050cebd1a35`. All 65 open PRs were enumerated through GitHub, their exact heads obtained, and their merge-base file diffs and migration declarations inventoried locally. This is an inventory and focused integration review, not a complete security review of every historical PR.

## Canonical contracts

- Keep the Notes/Life/Calendar/Study/Flashcards contracts already on main: `notes`/`note_versions`, `life_tasks`, `life_goals`, `study_flashcard_decks`, `calendar_events`, and metadata-only `activity_events`. Preserve the existing owner-filtered entity facade, optimistic `updated_date` writes and bounded workspace-search RPC.
- #388's feature implementation is already present through the merged dashboard foundation; its latest remaining merge-base diff is browser-test synchronization. Do not reapply its migrations.
- #391 introduces separate Notes, Calendar, Life, Flashcards, Quiz and Learn models. Its `time_entries.life_item_id` depends on `life_items`, while main uses `life_tasks`. Whole-branch integration would create competing sources of truth. Preserve that branch; port the distinct timer, quiz and course workflows only after adapting links and tests to the canonical model.
- #393 uses polymorphic `learning_records` plus a second note-version table for notes, tasks, goals, habits, decks and quizzes. Main already provides those records in dedicated tables. Do not add a parallel learning database. Reuse its learning UX and deterministic revision/scoring logic selectively when implementing the remaining course/quiz journey. Its HTML sanitizer also needs security review before reuse (text-node serialization must remain escaped).
- #395 uses dedicated private file metadata/version tables and Supabase Storage; it does not replace Notes. Its separate metadata-search RPC avoids replacing the canonical workspace-search migration. Integrate with explicit corrections for the create route and retrieval beyond the 500-file recent list. Two SQL files are repository proposals only; no database application is authorized until the intended staging identity is verified.
- #392 uses `projects.data.plan_items` and the existing compare-and-set interface. Keep it separate from `projects.data.decision_records` already merged through #397; no new project table or migration is needed.
- #387's catalog is opt-in browser-local metadata scoped by account. Preserve its no-raw-data storage rule; it is not hosted file storage. Its descriptive comparisons do not prove significance or causality.

## Other overlapping candidates

- Funding #374 → #376 → #378 → #379 is a stack. The later branches already contain earlier funding-ranking/comparison work. Review the cumulative patch rather than merging four copies. Both #378 and #379 include the same project-grant migration; apply it once only after staging review.
- Discovery #382 and #389 propose distinct rate-limit stores and API contracts. Select one shared atomic design after comparing fail-closed behavior, trusted client identity and deployment dependencies; do not install both limiters.
- #384 changes production routing and readiness across APIs. Keep it as a separate reviewed integration batch; public HTTP availability alone cannot validate those configuration gates.
- Older Research OS/security/UX stacks (#331/#333, #203, #89–#94 and related fixes) have substantial main-only history. An open PR is not proof that all its work is absent. The machine register records ancestry, patch-equivalent commits, exact changed files and shared migration tables. Remaining patches require behavior-level comparison before adoption; no historical whole-branch merge is approved by this inventory.

## Live verification boundary

Fresh connector checks expose only Supabase project `supabase-cyan-car` (`umzrggayitzfgrrofjnw`), previously identified as unrelated, and a Vercel Hobby team with no linked projects. The owner supplied `kbzjngpzxpniaumlupaa` as EYLO's intended project. Direct `get_project` returned permission denied. The existing `tests/e2e-supabase-project-concurrency.mjs` specifically identifies that ref as live EYLO and refuses staging writes to it; that guard remains intact. A separate authorized staging project is still needed. Vercel deployment lookup for the public hostname returned 404 in the connected team. No remote SQL, migrations, account creation, deployment, billing change or production writes were made.

The public URL passed 8/8 HTTP smoke checks using the environment proxy. Its manifest returns release label `2026-08-10-guided-discovery-eyra-resilience`; the reviewed Git SHA was not established. This is current availability evidence, not deployment-integrity or authenticated acceptance evidence.

Unblocked local work includes source integration, deterministic tests, browser fixtures, static checks and build verification. Live registration/recovery, real persistence and two-account RLS, Storage cleanup, scholarly quality judgments, authenticated EYRA, LiveKit media and Stripe sandbox lifecycle remain unverified. Never mark all 77 products complete from these checks.

## Completed local integration batch

1. `a617ced` integrates #395 with create-route correction, exact-ID retrieval outside the recent-file cap, account-scoped document drafts and stale-result guards. Browser fixtures were corrected to honor PostgREST singular responses and extract uploaded file bytes from multipart requests; hidden version options are checked as attached rather than visible.
2. `2a8ec2b` ports the reviewed #392 workplan patch onto the canonical project record. The combined browser suite preserves the existing Notes, Files and search cases and checks competing workplan sessions without discarding the losing draft.
3. `45f16d5` ports #387's local metadata catalog, descriptive comparisons and disclosure controls. All existing tests are retained. The workplan UI also permits an explicit Blocked state while a prerequisite is unfinished, matching domain validation.
4. Follow-up recovery hardening retains immutable version metadata and bytes when a later file-details update fails, with a test for that partial commit. The operation reports that the version was stored and requires reload/verification before retrying.

`scripts/integration/test-local-postgres.py` runs ten selected migrations on a disposable PostgreSQL 17.6 container with no network or published ports. Minimal local Auth identity and Storage metadata schemas replace the hosted services. The SQL checks real policy/trigger execution, owner and outsider visibility, owner-only associations, historical note snapshots, bounded search and stale compare-and-set rejection. Two independent database sessions competing on one project version produce one successful save and one conflict. This is stronger than an in-memory fixture, but does not verify Supabase Auth, PostgREST, Storage bytes or the deployed schema. The script removes only its own randomly named container.

## Original next-batch plan (superseded by continuation below)

- Adapt #391's distinct Time Tracker, Quiz and Learn workflows to the selected main contracts; do not install its competing Notes/Life/Flashcards migrations or #393's duplicate record store. Retain the unintegrated branch work for review.
- Review the funding stack cumulatively, preserving official source fields and applying each unique migration once.
- Select one discovery limiter after API and migration review. Current live retrieval diagnostics fail: 2/5 queries have sufficient source coverage; Europe PMC returned 503 and Semantic Scholar 429. These are recorded experimental observations, not scientific relevance judgments.
- Review #384 as a separate operational change, then run the remaining historical PR comparisons at behavior level. The 65-PR inventory does not authorize blind merges.
- Complete every unimplemented product's workflow specification and acceptance criteria. The current register explicitly retains incomplete and unimplemented products; no 77-product completion is claimed.

## Verified continuation — 2026-11-13

- `848484b`: adapted #391 timer/quiz/course workflows to canonical Notes/LifeTask; no competing Notes, Life, Calendar or Flashcard schema. Distinct #393 manual authoring behavior is included through those canonical workflows. Actual PostgreSQL exposed and corrected an ambiguous course-progress conflict target.
- `d38ad59`: removed Europe PMC's unsupported sort parameter after direct sorted requests returned 503 and unsorted requests returned 200. Added bounded provider retries/cache/cooldown/circuit behavior. Selected only #389's shared atomic quota, correcting its SQL CURRENT_TIME collision and saturating denied counters. #382 is not installed. Provider resilience is per runtime; quota is database atomic. Live candidate diagnostic now covers 4/5 queries, still FAIL overall; no invented replacement papers.
- `2807cef`: authenticated Responses API streaming and explicit saved conversations use canonical Ideas. Per-request record-action opt-in defaults off; server permissions remain authoritative. Source IDs and final stream completion are validated. Existing Notes/Life/Flashcard context is retrieved through canonical contracts. No separate memory database.
- `6c91aa9`: separate staging preflight and release SHA stamping subset of #384. No billing/contact-stack import, project provisioning, hosted migration or production promotion.
- `7cb7b2d`: integrates the cumulative funding stack (#374/#376/#378/#379) once: immutable official facts, comparison, project-scoped CAS drafts and Research Gap coverage/literature saving. Two unique proposed migrations are included once. Duplicate normalized DOI preflight fails without deleting legacy records. Actual SQL verifies scope, stale saves and identity uniqueness. Incorporates #387's precise Data Lab disclosure; #395's newer create-route correction is already equivalent to the existing integration fix.

Final local evidence at `19ee90b`: 609 tests plus imports/typecheck/lint/build, both browser fixture suites, sixteen selected PostgreSQL migrations/policies/RPCs and independent concurrent sessions. Exact commands/output are linked from verification.json. This is not the full historical migration chain or hosted Supabase acceptance. Live OpenAI, Stripe test payments, LiveKit media, hosted two-account/storage/deletion and independent human relevance acceptance remain NOT RUN. Separate staging and verified deployment identity remain release blockers; Continuation PR #401 stays draft; #398 was already merged externally.

Remaining work includes full specifications and acceptance for the 27 unimplemented products, incomplete criteria on the 49 partial products, other historical PR behavior reviews, source-coverage/relevance failures, and configured hosted acceptance. This continuation does not complete the 77-product mission.

## Concurrent branch reconciliation

The remote advanced from `604e629` to `002281a` during this local batch. Merge `195d99d` preserves all thirteen remote commits, including the canonical `eyra_conversations` / `eyra_messages` proposal, owner-scoped read API, provider error classification and PostgreSQL CI job. The final UI uses that canonical conversation contract; **the earlier local Idea-based conversation approach is superseded and not shipped**. Existing Idea Vault semantics remain dedicated to user ideas.

An additive migration extends canonical messages with bounded historical source attribution and a security-invoker atomic snapshot RPC. Each explicit Save creates a new immutable conversation snapshot; existing snapshots/messages are not rewritten. The browser lists and restores owner-filtered canonical records; raw provider diagnostics and credentials are never persisted. No staging schema was applied. Historical batch evidence mentioning Idea conversations describes an intermediate local implementation, not final behavior.

Previous review: [continuation #401](https://github.com/panagiotagrosdouli/eyloai/pull/401), same integration branch. GitHub reports #398 was already merged externally at `002281a` / merge `83a647f` on 2026-11-13 07:56 UTC. The integration session did not merge it. New continuation changes are not part of that merged PR; #401 contains the remaining diff against main. No duplicate open PR existed for this branch when #401 was created.

## Batch 4 — snapshot privacy and checklist recovery

Main advanced externally to `633de25` (merge of #401). This continuation fast-forwarded before edits. The unmerged `codex/eyra-conversation-saving-20261113` / #400 was reviewed at `9656499`: its per-message writer targets the same canonical tables, but introduces automatic user-message saving and does not save assistant responses/sources. It was not blindly merged into the explicit snapshot workflow. Its useful retry requirement is implemented as idempotent canonical snapshots with stable caller UUIDs and a bounded SHA-256 recovery digest; no competing data store or duplicate message schema is introduced.

Batch `784d1e5` adds owner/version-checked snapshot deletion with confirmation, source-preserving private export, stale-history invalidation, canonical read API source attribution and Reproducibility checklist CAS/recovery. One additive migration replaces the snapshot RPC signature with an optional stable UUID; exact replays return the same record, conflicting content is rejected and concurrent duplicate requests create one message set. Seventeen selected migrations passed local PostgreSQL; 611 combined tests and both fixture browser suites passed. Hosted deletion, full account privacy acceptance and live providers remain unverified. The 77-product status totals remain conservative: 49 partial, 27 not implemented, 1 infrastructure only; zero complete.

Current draft continuation: [#402](https://github.com/panagiotagrosdouli/eyloai/pull/402). Prior merged PRs are historical.

SQL follow-up `84efa01`: exact retry comparison normalizes omitted optional sources to the stored default empty array; the complete 17-migration disposable PostgreSQL suite passed again, including two independent same-ID snapshot writers.

CI run `43424465089` at `de485c1` exposed an actual speculative-insert race on the composite parent unique index, despite the primary-key conflict target. Repair `05241b7` handles all unique conflicts before the same owner lookup/content verification. The local suite passed with three overlapping transaction rounds; the original CI failure is preserved under evidence/2026-11-13. Final PR checks must pass before claiming CI success.

## Batch 5 — research provenance and protocol consistency

Started from externally merged #402 / main `b0124de`, preserving all prior changes. Commit `f7a2a18` repairs DOI-only identity and title-prefix collisions, keeps provider provenance through deduplication, fills only missing same-DOI/same-title abstracts, flags title conflicts, and carries attribution to UI/Library/EYRA context. Co-indexing remains one publication. Discovery saving reuses the canonical existing DOI repository, retaining project-conflict behavior and race recovery. Bounded overfetch changes candidate volume, not query text, request count, final display limits or relevance/benchmark gates.

Literature Review now uses Project.updateIfUnchanged, retains stale drafts, invalidates obsolete operations, locks editing during saves, preserves selected project in the URL and tests screening/export/switching/reload on real React pages with isolated Auth/PostgREST fixtures. No duplicate review/Notes tables are introduced. Combined check: 616 tests PASS. Both fixture suites PASS. Fresh candidate-handler live diagnostic: 3/5 coverage, 2/3 covered heuristic gates, mean0.80; overall FAIL and Semantic Scholar429. Earlier 4/5 is historical; no scientific relevance/human review or production acceptance claim.

No schema change or local PostgreSQL rerun was needed for this batch; canonical RLS/CAS proof from the prior 17-migration suite is retained with its scope. Final GitHub Quality Gate executes it independently. Hosted staging and live provider/payment/media/account acceptance remain blocked. All 77 products remain incomplete: 49 partial, 27 not implemented, 1 infrastructure only.

Exact-project follow-up `c842cc5`: the recent100 list is navigation, not permission to substitute another project for an explicit URL. Load the exact authorized row outside that cap, prioritize explicit URLs on query changes, and fail closed for missing/foreign rows. The expanded real-browser fixture checks these cases; combined616 tests PASS. Current draft #403; prior head adc5b38 passed all three Actions, and final follow-up CI must complete before its result is claimed. Latest Vercel failure is not attributed to the old quota: actual deployment metadata/build-log reads both return404 to the connected team.

## Batch7 — Research Journal, Experiment Lab, Publication Tracker

Source `4a044bceae97a87ac483d5b2985798ad941b8f1c` implements distinct project-owned workflows for products66/60/69 using existing projects.data and owner/version CAS, with no duplicate Notes tables, AI memory or new migrations. See RESEARCH_RECORDS_CONTRACT.md and batch-7-project-research-workspaces.json. Full local check640 tests, both browser fixture suites and18 selected PostgreSQL migrations/policies verify the local scope. These three move from not implemented to partial; totals52 partial/24 not implemented/1 infrastructure, zero certified complete. No hosted acceptance or production promotion is claimed.
