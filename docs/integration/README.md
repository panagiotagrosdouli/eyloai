# EYLO integration evidence — current audit2026-11-14

## Current continuation: batch12

[Exact scopes/commands](batch-12-core-acceptance.json), [current77-product tracker](../PRODUCT_IMPLEMENTATION_TRACKER.md), [checkpoint](CORE_CHECKPOINT_2026-11-14.md), [66 open heads at audit time](open-pr-current.json) and [current source inventory](repository-inventory-current.json) supersede earlier counts and deployment observations. Main3854e98 includes externally merged public day/night/Premium. The pending core candidate adds canonical Notes/tasks to the graph, safe gateway error attribution, saved-record Project Intelligence and a guarded28-file migration review/21-file local replay.

724 tests/static/build, five browser suites and real disposable PostgreSQL checks pass. Real public providers pass5/5 unchanged source/anchor gates locally; the deployed proxy fails0/5 at EYLO's unavailable quota service. Public source provenance matches main, but optional capabilities and hosted acceptance remain blocked.77 products have partial implementation; zero have complete acceptance. Both dependency audits report zero known advisories. No agent production promotion, remote migration, production-data write or live payment occurred.

Earlier sections below preserve chronological evidence; old3/5 results, schema counts, source SHAs and deployment failures are historical, not current acceptance.

These are incremental reviewed integration batches, not completion of all 77 products or production acceptance.

Baseline main: `7bf956a72d42f251c77cde7276dcb050cebd1a35`.

## Inventory and decisions

- [77-product candidate matrix](product-matrix.json): 77 partially implemented, 0 not implemented, 0 infrastructure only. **Zero products are certified complete.** Status is for this integration candidate; [the baseline matrix](baseline-product-matrix.json) preserves main's earlier evidence.
- [65 open PR heads and merge-base comparisons](open-pr-comparison.json), including patch-equivalent commit counts and migration paths. This snapshot predates this integration PR and is not a full behavior/security review of every historical PR.
- [Migration/table overlap](pr-migration-overlap.json) against the exact baseline; [Tracked source/API/migration/test/CI inventory](repository-inventory.json).
- [Canonical models, integration choices and remaining batches](INTEGRATION_DECISIONS.md).

The candidate integrates private Files/Create/Document Editor (#395), project workplans (#392), and the browser-local Data Catalog/descriptive comparisons (#387), while retaining main's canonical Notes/Life/Calendar/Flashcards models. Fixes include the new-document route, exact-ID access beyond recent file listings, preservation of committed versions after a metadata failure, and project actions that fit a mobile viewport. No feature or test was removed to obtain a passing result.

## Verification

Machine-readable results and their scopes are in [verification.json](verification.json). Genuine run output is preserved under [evidence](evidence), with trailing whitespace normalized.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run check` | PASS, 706 tests, 0 failed | Imports, frontend/API typecheck, ESLint, unit/API tests and Vite build |
| Browser regression | PASS | Actual pages and SDK calls against isolated Auth/PostgREST/Storage fixtures; auth, local analysis, catalog, Notes/Search, Files/documents, workplans, stale-write recovery and mobile viewport |
| PostgreSQL migration/policy test | PASS | Twenty-one selected migrations on disposable PostgreSQL 17.6; real SQL/RLS/triggers with synthetic Auth identity and Storage metadata schemas; two independent project-save sessions produce one success and one conflict |
| Strict public deployment probe | FAIL | deployment-status returns HTML with HTTP200; source SHA unverified; AI/contact/billing report false. Earlier 8/8 availability smoke is historical only. |
| Live retrieval diagnostic | FAIL | Candidate handler with real provider responses: 3/5 queries met strict primary-index source-coverage criteria; unsupported Europe PMC sort parameter removed; Semantic Scholar intermittent 429; overall diagnostic still FAIL; automated anchors are not human relevance judgments |
| Hosted persistence/RLS and providers | NOT VERIFIED | Intended Supabase ref permission denied; separate staging needed; Vercel project/deployment identity unavailable |

Existing build warnings about dependency annotations, mixed dynamic/static imports and large chunks remain visible in the build log. Passing compilation does not waive those limitations or the launch gates.

## Reproduce local checks

```bash
npm ci
npm run check
# Use Playwright's installed Chromium, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
npm run test:e2e:auth
npm run test:e2e:learning
# Requires the local Docker daemon; this creates/removes only its own container.
python scripts/integration/test-local-postgres.py
python scripts/integration/build-inventory.py
# Real provider responses through the candidate handler; expected diagnostic may fail.
NODE_USE_ENV_PROXY=1 node scripts/benchmark-local-discovery.mjs
```

The PostgreSQL runner never accepts a remote database URL. It runs with no container network or published ports and does not validate hosted Supabase services, scheduled monitoring, billing, or the full historical migration chain.

## Responsive fixture screenshots

Screenshots contain synthetic test records, not live user data or scientific evidence.

- [Document editor, mobile](screenshots/document-editor-mobile.png) and [wide](screenshots/document-editor-wide.png)
- [Project workplan, mobile](screenshots/project-workplan-mobile.png) and [wide](screenshots/project-workplan-wide.png)
- [Data comparison, mobile](screenshots/data-comparison-mobile.png)

## Release blockers

The owner identified `kbzjngpzxpniaumlupaa` as EYLO's intended Supabase project; the connector denied permission. Repository tests identify this as live EYLO and refuse staging writes to it. Connect a separate authorized staging project and disposable accounts before hosted schema/RLS/Storage acceptance. Do not use the unrelated connected `supabase-cyan-car` project.

The Vercel connection has no linked EYLO project, and deployment lookup returned 404 in the connected team. Public HTTP success cannot establish deployment provenance. Live OpenAI, LiveKit, Stripe sandbox lifecycle, registration/recovery, account deletion, accessibility acceptance and independent scientific judgments remain unverified. No remote database migration, production promotion, live payment or production-data write was performed.

## Continued candidate scope

Canonical Time Tracker, Quiz and Learn now include manual authoring and persistence journeys. EYRA adds authenticated Responses API streaming, account-scoped conversation snapshots through canonical EYRA conversations/messages, explicit per-request action opt-in, bounded context and output, and citation validation. Funding comparison preserves official source fields; grant drafts are isolated by owner/opportunity/project; Research Gaps saves canonical literature with duplicate DOI protection. One reviewed atomic discovery quota is required on Vercel, with provider retries, cooldowns, bounded caching and transparent failures. Hosted proxy failures cannot bypass quotas by calling providers directly.

[Final verification](verification.json) separates IMPLEMENTED, EXECUTED, VERIFIED, FAILED, BLOCKED and NOT IMPLEMENTED. [First-batch verification](verification-first-batch.json) is retained as history. Latest source tested locally: `6367187`. Browser evidence covers both fixture suites; screenshots show [EYRA mobile](screenshots/eyra-conversation-mobile.png), [EYRA desktop](screenshots/eyra-conversation-wide.png), and [Learn mobile](screenshots/learning-course-mobile.png). These are synthetic account fixtures, not hosted acceptance.

Separate staging is prepared, not provisioned or verified. Follow [owner configuration steps](../STAGING_OWNER_CONFIGURATION.md). The intended live Supabase project remains inaccessible, the connected Vercel team exposes no EYLO project, and the previous Vercel check reported a build-rate limit. No live OpenAI request, Stripe sandbox checkout, LiveKit media, hosted account deletion, remote migration, production data write or promotion was executed.

Historical review: [draft continuation #401](https://github.com/panagiotagrosdouli/eyloai/pull/401), same integration branch. GitHub reports #398 was already merged externally at `002281a` / merge `83a647f` on 2026-11-13 07:56 UTC. The integration session did not merge it. New continuation changes are not part of that merged PR; #401 contains the remaining diff against main. No duplicate open PR existed for this branch when #401 was created.

All three GitHub Actions passed at `493a33b`; the final saved-snapshot label correction also passed the combined 609-test check and browser suite locally. The Vercel preview at that head failed; current build logs are inaccessible through the connected team. Its cause is unverified and is not attributed to the earlier historical rate limit. Final PR checks remain authoritative.

## Privacy and concurrency continuation

PR #401 was merged externally as `633de25`; this continuation starts from that main head, preserving all earlier changes. [Batch 4](batch-4-eyra-privacy-concurrency.json) adds idempotent snapshot retries, private JSON export, explicit confirmation and owner/version-checked saved-snapshot deletion, late-history invalidation and reproducibility checklist CAS. Browser fixtures reproduce a committed save followed by lost transport and confirm a retry does not duplicate it; real independent PostgreSQL sessions verify the same behavior. Exports do not call AI. Saved snapshot deletion is not full account deletion and cannot erase already downloaded exports. No remote migration or production change was executed.

Previous review: [#402 (externally merged)](https://github.com/panagiotagrosdouli/eyloai/pull/402), head source `784d1e5` plus evidence commits. #398 and #401 were merged externally; this session did not merge them. No duplicate open PR existed for the branch.

## Research provenance and Literature Review continuation

Main advanced externally to `b0124de` (merge of #402). [Batch 5](batch-5-research-provenance-review.json) preserves co-indexing, DOI identity and the donor of a missing abstract, with conflict disclosure. Discovery Library saves now reuse the existing canonical DOI repository rather than competing source-ID matching logic. Literature Review adds project CAS, draft retention, scoped reload, confirmation and export browser acceptance. No new schema or remote migration.

Fresh real-provider diagnostic: **FAIL**, strict source coverage **3/5**, covered-query heuristic gates **2/3**, mean anchor coverage **0.80**, Semantic Scholar HTTP429. Earlier 4/5 is historical and is not carried forward as current acceptance. Candidate overfetch is bounded, queries and pass thresholds unchanged, and co-indexed records are not counted as independent studies. No papers are invented. See the machine-readable report and exact logs. PostgreSQL schema is unchanged; prior local 17-migration evidence is retained, not misrepresented as a new local run.

Screenshots: [Literature Review mobile](screenshots/literature-review-mobile.png), [scholarly provenance mobile](screenshots/scholarly-provenance-mobile.png). They use synthetic provider-shaped fixtures, not hosted account data. The final continuation draft and its CI are linked in the GitHub branch review.

Historical review: [draft #403](https://github.com/panagiotagrosdouli/eyloai/pull/403). Exact project deep links beyond the recent100 are loaded with owner-filtered Project.get; missing/foreign targets fail closed and never substitute another owned project. The expanded browser and616-test check passed. Vercel preview at adc5b38 failed; current metadata and logs return404 under the explicitly scoped connector, so its cause is unverified. Historical rate-limit evidence is not used as proof of this new cause.

Browser follow-up6367187 separately verifies a synthetic foreign-owner row and a nonexistent ID, both failing closed with the same error. This is client owner-boundary evidence, not hosted two-account RLS acceptance. Final draft403 check results remain authoritative.

## Market acceptance batch6 — historical PR #404 (merged externally)

[Batch6](batch-6-market-readiness.json) records the same-route account isolation regression and fix, canonical workspace export v2, guarded staging isolation probe and 14-gate acceptance evidence validator. Both fixture browser suites pass; all30 canonical export tables have owner-readable contracts with RLS enabled in disposable PostgreSQL. Empty scopes do not establish isolation. `npm run release:readiness` intentionally returns NO-GO/exit1 until real, reviewed acceptance exists. See [owner steps](../release/MARKET_READINESS_RUNBOOK.md). No hosted/provider/legal/operational acceptance is inferred from these local checks.

## Batch7 — project research workflows

[Evidence and exact commands](batch-7-project-research-workspaces.json), [contract and limits](RESEARCH_RECORDS_CONTRACT.md). Products60/66/69 now have implemented local workflows with canonical project storage, owner/version saves, retained drafts, validated statuses, private export and confirmed deletion. Both fixture browser suites and18-migration disposable PostgreSQL suite pass. No schema added. Totals:52 partial,24 not implemented,1 infrastructure only; zero certified complete. Hosted and production acceptance remain unverified.

## Batch8 — Research Budget and Thesis Studio

[Evidence and exact commands](batch-8-budget-thesis.json), [contract and limits](PLANNING_WORKSPACES_CONTRACT.md). Budget arithmetic uses integer minor units; Thesis compiles existing saved Notes without a parallel writing database. Both have explicit owner/version saves, conflict comparison, guarded exports and fixture/SQL coverage. Notes now opens authorized exact IDs beyond the recent cap. Totals54 partial/22 not implemented/1 infrastructure, zero certified complete; hosted and full-product acceptance remain open.

Previous continuation (merged externally): [#405](https://github.com/panagiotagrosdouli/eyloai/pull/405). Its description records final-head GitHub Actions; earlier PR/run IDs in historical sections remain historical.

## Batch9 — all22 missing implementations

[Actual scopes and remaining criteria](REMAINING_22_PRODUCT_CONTRACTS.md), [per-product register](batch-9-product-scopes.json), [evidence/exact commands](batch-9-all22-products.json). All22 now have implemented local flows; task Automations26 also has real user-triggered execution/history. Counts77 partial/0 without implementation/0 infrastructure-only/0 complete. The all22 browser suite includes an actual local production build and network-off encrypted Offline reload. SQL uses19 selected migrations in disposable PostgreSQL. No hosted migration/deployment or production-data/payment action occurred; release remains NO-GO.

Previous draft (merged externally): [#407](https://github.com/panagiotagrosdouli/eyloai/pull/407). Its description records exact final-head CI and Vercel observations. The first batch9 head `13a8117` received a successful GitHub Vercel status, while connected-team deployment metadata remains inaccessible (404); preview build status is not hosted acceptance or verified staging identity.

## Batch10 — privacy export and workflow integrity (2026-11-14 Europe/Athens)

[Exact commands, results and updated product scopes](batch-10-workflow-polish.json). Main advanced externally to `b912d9f` after PR407 was merged; this continuation preserves it. Settings portable workspace v3 now covers40 owned/authored collections, with the directory primary key handled correctly, token secrets/digests excluded, owner validation and account revalidation. Received/shared third-party contributions and file bytes remain outside this bounded export; full personal-data access/deletion is not claimed.

Translation saving now rejects missing/added/altered numeric bracket citations, DOI identifiers and URLs, including repeated counts; author/year references and translation quality still require review. Smart Forms exports saved responses to formula-safe quoted CSV with stable IDs; unsaved changes are excluded. Calendar preserves all-day dates across timezone boundaries, edits them without turning them into timed events, handles exclusive ends and shows spans in the correct month/day. [Mobile Calendar fixture](screenshots/calendar-all-day-mobile.png).

688 tests, all three browser suites and19 selected migrations on disposable PostgreSQL pass. Browser transport is synthetic; the production Offline reload actually disables network. The fresh real-provider diagnostic remains **FAIL3/5** coverage, with Semantic Scholar429, and is retained with unchanged queries/gates. A cancelled/superseded CI run is never relabelled as passed; final exact-head results belong in the new draft continuation description. Counts remain77 partial /0 without implementation /0 certified complete. No hosted migration or production action; release remains NO-GO.

Previous continuation (merged externally): [#408](https://github.com/panagiotagrosdouli/eyloai/pull/408). Initial Product quality CI failed on an asynchronous fixture-login navigation race; repaired with an explicit successful sign-in navigation wait. Local production-bundle suite passes again. Calendar additionally rejects impossible dates (e.g.30 February) rather than moving them silently, while accepting a valid leap day. Final combined check:689 tests. PR408 records exact final CI and Vercel outcomes; the initial failure is preserved in evidence/2026-11-14/batch10-ci-auth-race.txt.

## Batch11 — real retrieval coverage and staged account deletion

[Exact results and scopes](batch-11-retrieval-privacy.json), [account-deletion contract](ACCOUNT_DELETION_CONTRACT.md). Starts from externally merged PR408/main879e29f. Real retrieval now passes5/5 source coverage and5/5 anchor gates, mean0.94, in three actual-provider executions. arXiv uses explicit Boolean field groups, Europe PMC requests core abstracts, Crossref uses bibliographic terms and supplied abstracts retain useful bounded context. Original-query relevance/DOI deduplication gates are unchanged; the diagnostic is strengthened to require all five cases. Metadata/provenance for50 actual returned papers is preserved. Semantic Scholar429 remains visible and human relevance acceptance is not claimed.

Reauthenticated resumable account deletion is implemented for isolated free-account/password staging, default disabled and refused in production, forbidden refs and Stripe-enabled environments. SQL locks old JWT/personal-token access, revokes sessions, controls service-only worker leases, orders actual Storage API removal before Auth deletion and verifies absence before completion. The reviewer FK preserves another author's manuscript. Browser cleanup removes owned catalogs/drafts/Offline data and isolates legacy unowned private caches; see the compatibility/retention limits in the contract. MFA/passwordless/paid/provider-retention workflows and actual hosted acceptance remain open.

706 tests, all three local browser suites and21 selected disposable PostgreSQL migrations pass. Browser/server HTTP transport is synthetic; SQL is real; public scholarly providers are real; hosted Supabase/Storage/Auth deletion was not executed. The final draft continuation records exact-head CI and Vercel observations. Counts remain77 partial,0 without implementation,0 certified complete. No remote migration, production deployment/data write or live payment occurred. Release remains NO-GO until real reviewed acceptance.
