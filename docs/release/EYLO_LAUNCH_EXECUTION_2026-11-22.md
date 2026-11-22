# Whole-product launch execution — 22 November 2026

The user requested the whole EYLO product, including EYRA, ready for release. The targeted EYRA schema scope is authorized; the existing backup/recovery gate remains unsatisfied. This is an execution record, not launch approval.

## Completed

- Promoted the existing production build for main `1b2fcebc331c825a20458cda7be2a7ba7464bf02`, deployment `dpl_D7UNzWVx2zoZiorGsnveA3pisZEi`, project `prj_yiujFufSKIRnlmZUr9WG7jgf7qKL`, team `team_IUkyJtLhpTRBaUikmCSYHBDn`.
- Independently verified public browser manifest and server SHA now match. Real scholarly discovery returned a record. Earlier public SHA `bd9e9723` is superseded.
- Full check: 1,220 Node tests, imports, frontend/API typechecks, lint and production build passed.
- Full browser Auth, 22-product and Learning suites passed against synthetic transport. Fixed the recovery test's late response listener, preserving all outage assertions.
- Full disposable PostgreSQL integration passed, including ownership, snapshots, concurrency and schema/grant negative checks. These tests do not establish hosted Auth, Storage bytes or real provider acceptance.

## Remaining database work

The correct live project is `kbzjngpzxpniaumlupaa`. Fresh observations, not an automated migration instruction, are in `../integration/launch-database-coverage-2026-11-22.json`.

| Feature | Confirmed missing | Candidate source for review |
| --- | --- | --- |
| EYRA history/actions | conversations, messages, agent runs/actions | Four exact files and hashes in the previously approved targeted plan |
| Grant applications | grant_applications | `20261112090000_project_scoped_grant_applications.sql` |
| Directory, Teams, Connections, Community, Peer Review, Feedback, API tokens | Ten eylo_* tables | `20261113180517_complete_workspace_products.sql` |
| Native meeting participants | meeting_participants | `20261110_native_video_meetings.sql` |

Do not bulk-push historical migrations or replay already-applied workspace repairs. Review dependencies, functions, triggers, grants, source hashes and existing table shapes for each candidate. Historical migration-version divergence remains open. The historical scheduled-monitoring `system_secrets` table is also absent; it is not an automatic repair candidate, because that capability is deliberately disabled and runtime source no longer directly references it.

## Execution order and acceptance

1. Verify the current production backup/recovery point. Connected tools expose no backup inventory; the user has been asked for the missing evidence. No repeat scope approval is required for the already authorized EYRA change.
2. Apply the exact targeted EYRA scope only after its gates are satisfied; recheck schema, RLS, grants, RPC signatures and advisors. Do not fabricate migration registry equivalence.
3. Validate expanded product migrations independently on isolated staging before production application. Keep recoverability and data-preserving forward repair for any table that has received user data.
4. Use two real consenting test accounts: search and verify a paper/source, save/reload/export from Library, Projects CRUD, Files upload/version/download/delete, deny cross-owner exact-ID access and writes, real EYRA provider response/citations/save/reload, grant application persistence, team invitation boundaries and meeting membership.
5. Verify recovery email arrival and support delivery using real configured services. Contact is currently disabled; credential presence alone does not justify enabling it. Billing stays disabled until test checkout/webhooks/idempotency/entitlements/refunds have evidence; never enable live charges from this report.
6. Verify manual and scheduled monitoring separately, including consent, retries and actual persisted results. Institution analytics remains disabled until its own acceptance.
7. Repeat public provenance and core smoke checks on the exact resulting deployment, then make the release decision from the full evidence. Public health alone is insufficient.

## Limits

No production schema changes, new Auth accounts, secret extraction, payment or new infrastructure purchase occurred in this execution. No hosted private-account flow or real model response was verified. The latest deployment's error/fatal log grouping over ten minutes returned no groups; traffic volume and complete coverage are unknown. Commercial release remains blocked by the outstanding dependencies above.
