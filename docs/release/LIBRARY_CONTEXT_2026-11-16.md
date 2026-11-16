# Library context implementation, 2026-11-16

Based on main `6132576f95780caa7a3cf1faac6ac3e663cf0ac0`, after PRs #484, #485 and #486 were merged externally. This change does not merge a PR, promote production, modify a hosted database or access real research data.

## Implemented

- Library `focus` links now use the same publication set for displayed cards and BibTeX/RIS exports. Exact owner-checked reads recover a publication beyond the newest 1,000 records. Missing/inaccessible targets show a recoverable failure; they never substitute unrelated recent publications.
- `project_id` is verified against the exact private project. All three collections are filtered in the database before their limits. The selected project remains available even outside the recent project list. Papers, researchers and funding have explicit project filters and correctly scoped empty states.
- Research Journey and the project evidence empty state retain `project_id` when opening Library. Library offers the corresponding review-protocol link and an explicit return to the entire Library.
- Obsolete load completions cannot replace a newer view. An expected owner can now be supplied to the existing entity `filter` method, matching its existing `list`/`get` protection. Wrong-owner raw responses fail closed before deserialization.
- Initial rendering is bounded to 50 matching cards, with an explicit Show more action. Citation export continues to use all loaded matching publications. Loading limits for records and for the project picker are disclosed separately.
- Library source/profile/funding links use the existing safe-URL check, excluding executable schemes and embedded credentials.

## Exact files

- `.github/workflows/quality.yml`
- `package.json`
- `src/lib/library-view.mjs`
- `src/lib/research-journey.mjs`
- `src/pages/Library.jsx`
- `src/pages/ProjectDetail.jsx`
- `src/services/supabase-entities.js`
- `tests/e2e-library-context.mjs`
- `tests/library-view.test.mjs`
- `tests/library-reference-export-ui.test.mjs`
- `tests/research-journey.test.mjs`
- `docs/release/LIBRARY_CONTEXT_2026-11-16.md`

## Verification

The new browser test was first run against the unchanged baseline in a separate worktree, with a small fixture for a fast reproduction. It failed because the requested publication appeared alongside three unrelated cards. The new implementation passed with a larger fixture containing more than 1,000 papers and projects.

- `npm run check`: imports, both TypeScript projects, lint, 944 Node tests, production build and chunk budget passed.
- Eight new Library loader tests passed. Existing citation export, journey and ownership tests were extended or retained.
- `npm run test:e2e:library`: actual browser and Supabase client, synthetic HTTP at 1440px and 390px. Checks direct older-source retrieval, matching single/project RIS exports, project scope across all three collections, denied targets, raw foreign-owner rows, expected-owner mismatch, transient recovery, stale-load rejection, safe URLs, empty states, project switching and 50/100-card rendering. Added to Product quality CI.
- `npm run test:e2e:auth`: existing complete browser suite passed, including Library link persistence and real bibliography downloads against fixtures, project/research workflows, error recovery and mobile navigation.
- `python3 scripts/integration/test-local-postgres.py`: passed in disposable local PostgreSQL, including actual policies, two-identity ownership isolation, project concurrency, private conversations and storage metadata. No hosted service was targeted.
- `git diff --check`: passed. Synthetic desktop/mobile screenshots were captured and visually inspected.

## Deployed metadata inspection

The connected Supabase account now exposes the matching live EYLO project `kbzjngpzxpniaumlupaa` as `ACTIVE_HEALTHY`. Read-only catalog/advisor requests on 2026-11-16 found:

- All 34 observed public tables have RLS enabled. Inspected Project, SavedPaper, SavedResearcher and SavedOpportunity policies restrict authenticated reads/deletes to `auth.uid() = user_id`; inserts and updates also check the owner. Profile policies use `auth.uid() = id`. This is policy inspection, not execution with two hosted user JWTs.
- The `discovery_rate_limits` no-policy informational advisory is consistent with its server-only boundary: inspected `anon` and `authenticated` SELECT/INSERT grants are absent. No public policy was added to this table.
- Security advisor warning: leaked-password protection is disabled. See [Supabase's remediation guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Production Auth configuration was not changed.
- `eyra_conversations`, `eyra_messages`, `eyra_agent_runs` and `eyra_agent_actions` are absent from the live public schema. Existing repository migrations/local tests do not establish deployed conversation persistence or durable action history. Migration reconciliation and staging acceptance remain release blockers; no new competing schema was created and no hosted migration was applied.
- The health advisor returned no findings in this query. This does not establish end-to-end service availability.

Only schema, policy and privilege metadata were queried. No private research records or real account contents were read or modified.

## Limits and release status

No new schema, permissions, RLS policy, model behavior or payment integration is introduced. Browser fixtures and local PostgreSQL cannot establish hosted Supabase Auth/PostgREST/Storage isolation. Authorized two-account staging acceptance remains outstanding.

The Library still loads a bounded maximum of 1,000 matching rows per collection. Show more expands rendered cards within that loaded set; it is not server pagination or a complete workspace export. An explicit source link bypasses the recent-list window through an owner-checked exact lookup. Cross-project evidence remains stored using the existing single `project_id` contract.

Discovery search still has its existing save/link workflow. This PR does not claim the whole research journey, full-site redesign or human scientific validation is complete. No publication accuracy, retrieval relevance, PRISMA compliance, accessibility conformance or production-readiness certification is claimed. Review exact-head CI and authorized staging behavior before approving release.
