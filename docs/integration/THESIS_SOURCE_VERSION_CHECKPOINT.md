# Thesis source versions: batch13 checkpoint

Base main: `efbb07251ffced13ff3fabf6d1ee83eabad3129a` (PR414 was merged externally). Tested runtime: `f48e8430d49085384aa1b8a25565806329134090`. Candidate branch: `codex/eylo-thesis-source-versions`. Keep the continuation draft; market release remains NO-GO.

## Implemented

Chapters can follow the latest saved canonical Note or explicitly pin its current saved version. Existing outlines remain compatible. Loading/export uses the current owner-authorized Note first, then at most one exact historical row when needed. Raw owner, note ID, version and project association must match. No Note content is duplicated into the project, no separate memory/version store is introduced, and no SQL/schema changes were made.

Counts and Markdown/version2 JSON exports use the chosen version. Later Note edits cannot silently change a pinned chapter. Missing/pruned history, deleted or moved Notes and unexpected foreign rows cannot substitute latest content. The editor supports an explicit repin to the current version; this changes only the project outline using its existing compare-and-set save.

Canonical Note history retains50 old revisions. Pins do not extend retention and cannot guarantee permanent availability. Archived rows have an archive timestamp, not the original save timestamp; exports leave that original timestamp unknown. Academic/citation correctness and publication-grade formatting remain outside this change.

## Executed evidence

Artifacts: [batch13](batch-13-thesis-source-versions.json), [current verification](verification.json), [logs](evidence/2026-11-14-thesis/check.txt).

- `npm run check`: PASS732/732, imports, typecheck, ESLint and production build.
- `node --test tests/thesis-note-source.test.mjs tests/thesis-outline.test.mjs`: PASS10/10.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:learning`: PASS full synthetic browser workflow including source pins, later Note changes, exact Markdown/JSON export, forged foreign history, pruning refusal and explicit repin. Hosted RLS is NOT VERIFIED.
- Fresh hosted five-query retrieval: FAIL0/5, quota503 `DISCOVERY_RATE_LIMIT_UNAVAILABLE`; provider health not evaluated.
- Fresh anonymous public frontend/server provenance matches base main; the capability probe FAILS because AI/contact/billing/scheduled monitoring/institution analytics are false.
- `npm run release:readiness`: expected NO-GO/exit1 for tested source.

Previous21-migration disposable PostgreSQL, four other browser suites, local real-provider5/5 and zero-advisory evidence are retained separately. Those were not newly executed hosted acceptance tests. Exact final-head CI belongs in the draft PR description.

## Required hosted acceptance and owner configuration

The connected Supabase account still shows only unrelated `umzrggayitzfgrrofjnw`; Vercel lists no linked projects. Live EYLO `kbzjngpzxpniaumlupaa` remains forbidden for staging. Follow [owner configuration](../STAGING_OWNER_CONFIGURATION.md) and [market runbook](../release/MARKET_READINESS_RUNBOOK.md). No credentials belong in chat or Git.

On independently verified separate staging: account A creates a Note and project chapter, pins version1, updates the Note, reloads and exports the original content; checks exact version/archive attribution; then repins explicitly. Account B attempts the known project, Note and version IDs and must receive no private content or write access. Test deleted/moved Notes and history beyond50 revisions; an unavailable pin must block save/export rather than follow latest. Verify ordinary unpinned chapters continue following latest and stale project saves retain local edits.

Hosted Auth/Storage/file bytes/deletion, OpenAI, Stripe sandbox, LiveKit media, scientific human relevance, legal/operations and pilot gates remain open. Full advanced scope for all77 is not complete. No agent production promotion, remote migration, production-data write or live payment occurred.
