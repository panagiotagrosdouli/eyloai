# EYLO integration evidence — 2026-11-13

These are incremental reviewed integration batches, not completion of all 77 products or production acceptance.

Baseline main: `7bf956a72d42f251c77cde7276dcb050cebd1a35`.

## Inventory and decisions

- [77-product candidate matrix](product-matrix.json): 49 partially implemented, 27 not implemented, 1 infrastructure only. **Zero products are certified complete.** Status is for this integration candidate; [the baseline matrix](baseline-product-matrix.json) preserves main's earlier evidence.
- [65 open PR heads and merge-base comparisons](open-pr-comparison.json), including patch-equivalent commit counts and migration paths. This snapshot predates this integration PR and is not a full behavior/security review of every historical PR.
- [Migration/table overlap](pr-migration-overlap.json) against the exact baseline; [Tracked source/API/migration/test/CI inventory](repository-inventory.json).
- [Canonical models, integration choices and remaining batches](INTEGRATION_DECISIONS.md).

The candidate integrates private Files/Create/Document Editor (#395), project workplans (#392), and the browser-local Data Catalog/descriptive comparisons (#387), while retaining main's canonical Notes/Life/Calendar/Flashcards models. Fixes include the new-document route, exact-ID access beyond recent file listings, preservation of committed versions after a metadata failure, and project actions that fit a mobile viewport. No feature or test was removed to obtain a passing result.

## Verification

Machine-readable results and their scopes are in [verification.json](verification.json). Genuine run output is preserved under [evidence](evidence), with trailing whitespace normalized.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run check` | PASS, 609 tests, 0 failed | Imports, frontend/API typecheck, ESLint, unit/API tests and Vite build |
| Browser regression | PASS | Actual pages and SDK calls against isolated Auth/PostgREST/Storage fixtures; auth, local analysis, catalog, Notes/Search, Files/documents, workplans, stale-write recovery and mobile viewport |
| PostgreSQL migration/policy test | PASS | Sixteen selected migrations on disposable PostgreSQL 17.6; real SQL/RLS/triggers with synthetic Auth identity and Storage metadata schemas; two independent project-save sessions produce one success and one conflict |
| Public HTTP smoke | PASS, 8/8 | HTTP availability only; deployed commit not established |
| Live retrieval diagnostic | FAIL | Candidate handler with real provider responses: 4/5 queries met source-coverage criteria; unsupported Europe PMC sort parameter removed; Semantic Scholar intermittent 429; overall diagnostic still FAIL; automated anchors are not human relevance judgments |
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

[Final verification](verification.json) separates IMPLEMENTED, EXECUTED, VERIFIED, FAILED, BLOCKED and NOT IMPLEMENTED. [First-batch verification](verification-first-batch.json) is retained as history. Latest source tested locally: `c02ae97`. Browser evidence covers both fixture suites; screenshots show [EYRA mobile](screenshots/eyra-conversation-mobile.png), [EYRA desktop](screenshots/eyra-conversation-wide.png), and [Learn mobile](screenshots/learning-course-mobile.png). These are synthetic account fixtures, not hosted acceptance.

Separate staging is prepared, not provisioned or verified. Follow [owner configuration steps](../STAGING_OWNER_CONFIGURATION.md). The intended live Supabase project remains inaccessible, the connected Vercel team exposes no EYLO project, and the previous Vercel check reported a build-rate limit. No live OpenAI request, Stripe sandbox checkout, LiveKit media, hosted account deletion, remote migration, production data write or promotion was executed.

Current review: [draft continuation #401](https://github.com/panagiotagrosdouli/eyloai/pull/401), same integration branch. GitHub reports #398 was already merged externally at `002281a` / merge `83a647f` on 2026-11-13 07:56 UTC. The integration session did not merge it. New continuation changes are not part of that merged PR; #401 contains the remaining diff against main. No duplicate open PR existed for this branch when #401 was created.
