# EYLO workflow integration and release blockers

Snapshot taken 2026-11-12. This is a branch review record; it does not certify staging or production acceptance.

## Safe integration order

The funding changes share `src/pages/Opportunities.jsx`, `src/lib/funding-api.js`, and `src/lib/funding-ranking.mjs`. Integrate and re-test them in this order:

1. #374 — preserve the provider facts and harden ranking.
2. #376 — add comparison on top of the preserved provider records.
3. #378 — add project-scoped grant drafts on top of the comparison branch.
4. #379 — add scholarly search/save on top of the grant and funding changes.

These four PRs currently target the same main commit. Their overlapping files require a reviewed combined candidate; the green checks on isolated branches do not prove that candidate is conflict-free.

The account/workspace branches are separate areas of work: #386 adds For You, #389 adds discovery rate limiting, #390 adds team matching, #388 adds Notes/Life/Calendar/Study/Flashcards/Activity/Search, and #392 adds project workplans. #389 changes discovery API and has its own migration; review it with #379 because both affect research-discovery requests. #388 and #392 do not share migration files, but their combined project detail/navigation must be exercised after integration.

## Migration dependency map

| Migration source | Dependency / ordering constraint | Staging status |
| --- | --- | --- |
| #378 `20261112090000_project_scoped_grant_applications.sql` | Existing `projects`, `saved_opportunities`, authenticated users; shared by #379's branch, apply once only | Not applied |
| #379 `20261112091000_saved_paper_identity_uniqueness.sql` | Existing `saved_papers`; coordinate with saved-paper insertion/search code | Not applied |
| #389 `20261112_shared_discovery_rate_limit.sql` | Discovery API authorization and configured server-side Supabase credentials; independent of workspace tables | Not applied |
| #388 `20261112154425_private_notes.sql` | Existing `projects`, authenticated users | Not applied |
| #388 `20261112161818_eylo_life_tasks.sql` | Existing `projects`, authenticated users | Not applied |
| #388 `20261112163010_eylo_life_goals_milestones.sql` | Existing `projects`, authenticated users | Not applied |
| #388 `20261112165449_eylo_study_flashcards.sql` | Existing `projects`, authenticated users | Not applied |
| #388 `20261112173500_eylo_calendar_events.sql` | Existing `projects`, authenticated users | Not applied |
| #388 `20261112181000_eylo_activity_history.sql` | `projects`, Notes, Life tasks/goals, decks, calendar events | Not applied |
| #388 `20261112183722_universal_workspace_search.sql` | Core `projects`, `ideas`, `saved_papers` plus all #388 tables above | Not applied |
| #392 | No new schema migration; workplan lives in owner-scoped `projects.data.plan_items` and uses `updated_date` compare-and-set | Not applicable |

Apply only after reviewing the complete migration set against the intended staging schema. The timestamp order within #388 is intentional: activity history follows all audited entities, and workspace search follows all searchable tables. The project grant migration appears in both #378 and #379 diffs and must not be applied twice.

## Database access blocker

The connected Supabase account exposed only project `supabase-cyan-car` (`umzrggayitzfgrrofjnw`), which the task owner identified as unrelated. No migration or SQL was run against it. The correct staging project was not discoverable from the authorized connection, so database syntax, migration application, RLS, two-account isolation, trigger transaction behavior, and optimistic-concurrency behavior remain unverified against Supabase.

Owner action: connect the intended staging Supabase organization/project or provide its project ref and authorized staging access. Then apply the reviewed migrations to staging only, create two test accounts, and run authorized/unauthorized RLS, deletion, and simultaneous compare-and-set tests. Do not point this checklist at production.

## Preview deployment blocker

The Vercel check reports: `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")`. This is Vercel's account daily deployment quota, not a reported application compilation failure. The connected Vercel project listing returned no EYLOAI project, so the preview deployment itself could not be inspected here.

Owner action: wait for the 24-hour quota reset or upgrade/restore the Vercel deployment quota, then rerun the required Preview deployment for each integration candidate. Verify the deployed commit SHA, API routes, and authenticated browser workflows. Do not waive branch protection or treat the quota failure as a successful deployment.

## Acceptance boundary

Local checks exercise application logic and isolated provider-shaped fixtures only. No real staging database, two-account RLS, production write, Vercel Preview, or production release verification has occurred. Keep #388 and #392 as drafts until those environment checks pass. Do not merge or deploy as part of this review.
