# EYLO Autonomous Execution Tracker

Last reviewed: 2026-11-22 (Europe/Athens)
Current main commit: `c7b331454d54ca72486a799994c13ca7cbec4aeb`
Production: `https://eyloai.vercel.app`, Vercel deployment `dpl_Af3vmLQDRc8gHXs8D1EAVN6wmaqF` (READY; production alias)
Execution phase: production acceptance and P0 blocker resolution
Release state: **NO-GO**

## Scope and source of truth

This tracker continues the existing product work; it does not restart completed tasks. The repository's 77-product inventory and route/action mapping are in [the full-site functional audit](FULL_SITE_FUNCTIONAL_AUDIT.md) and [source inventory](integration/full-site-source-inventory.json). The current execution baseline and detailed acceptance sequence are in [the launch execution record](release/EYLO_LAUNCH_EXECUTION_2026-11-22.md).

The current execution workspace contains the task attachment but no local Git checkout. Repository edits and verification were therefore performed through reviewed GitHub pull requests and CI. PR #593 contains the tracker/readiness report, PR #594 contains evidence-safe business planning, and PR #595 contains the proposed additive FK indexes. All remain open and unmerged; no production database or application deployment was changed.

## Current verified baseline

- GitHub `main` is `c7b331454d54ca72486a799994c13ca7cbec4aeb`. The Vercel production alias `eyloai.vercel.app` serves a READY deployment for the same commit.
- Live GET checks on 2026-11-22: `/release.json` 200 with the same commit; `/api/capabilities` 200 (`ai=true`, `contact=false`, `billing=false`, `scheduled_monitoring=false`, `institution_analytics=false`); one OpenAlex climate-adaptation discovery request returned HTTP 200 and a real indexed record. A separate one-record provider health pass returned OpenAlex 200/one record, arXiv 200/one Atom entry, Crossref 200/one item, Europe PMC 504/provider timeout, and Semantic Scholar 429/rate limited. This is a narrow availability probe, not multi-domain retrieval-quality evaluation. Public `/start`, `/company`, `/plans`, `/contact`, `/discover`, `/search`, `/login` and `/register` routes all returned HTTP 200. A live desktop homepage check at 1363×936 found no horizontal overflow; the contact page clearly reported delivery disabled and kept Send disabled. This did not verify mobile layout or submit a contact message.
- Supabase project `kbzjngpzxpniaumlupaa` is `ACTIVE_HEALTHY`. Its migration registry currently lists 19 migrations through `20261115194359`. The only listed development branch, named `main`, has branch status `MIGRATIONS_FAILED` while its preview project reports `ACTIVE_HEALTHY`; this is not verified staging acceptance, and no reset, delete or migration action was taken.
- Read-only schema inventory confirms EYRA conversations/messages/runs/actions, grant applications, ten team/directory/community/peer-review/API-token tables, and meeting participants are absent. Core Projects, Files, File Versions, Notes, and Learning tables are present. This is a catalog observation, not two-account acceptance.
- Current Supabase security advisors: leaked-password protection disabled (WARN); `discovery_rate_limits` has RLS enabled and no policies (INFO; fail-closed behavior may be intentional and must be checked against the service access path before changing it).
- Current performance advisors report 13 unindexed foreign keys and unused-index observations. An additive, idempotent index migration and exact catalog assertions are proposed in PR #595; Build, Product quality, EYLO Quality Gate, disposable PostgreSQL preflight, and Vercel preview passed on head `179eb8a05e041ef1f75c3cbe8afd2e35886954d5`. This is source/CI evidence only; no hosted index was created.
- The repository records 1,220 Node tests, imports, typechecks, lint, production build, full synthetic-transport Auth/product/Learning browser suites, and disposable PostgreSQL integration passing on the preceding release candidate `1b2fcebc331c825a20458cda7be2a7ba7464bf02`. On PR #595 head `179eb8a05e041ef1f75c3cbe8afd2e35886954d5`, GitHub Actions `Build`, `EYLO Quality Gate`, `EYRA schema preflight (disposable PostgreSQL)`, and `Product quality` all passed. Product quality covered production build, typecheck, lint, core regressions, EYRA/Auth/Library/Learning browser workflows, all 22 product workflows, gateway attribution, partial-source resilience, secure service credentials, and deterministic relevance benchmark; the Vercel preview reached READY. The disposable PostgreSQL replay also executed the 13 exact FK-index catalog assertions. PR #593 and PR #594 each retain their own previously passing CI and READY preview evidence. These are repository/preview checks, not hosted two-account acceptance or production provider acceptance.
- Vercel production error/fatal log grouping over the latest 30 minutes returned no groups; traffic coverage is unknown. The public release probe remains `PROBE_FAILED` for commercial readiness because contact and billing are unconfigured. Public reachability does not prove private-account workflows.

## Feature inventory and state

| ID | Feature | State | Next action |
|---|---|---|---|
| REL-001 | Production identity and public deployment | HOSTED VERIFIED for commit identity and public GET checks | Keep provenance and core smoke checks on the resulting reviewed deployment |
| DISC-001 | Public scholarly discovery | PARTIALLY FUNCTIONAL; one live OpenAlex result; no current multi-domain human relevance evaluation | Run multi-domain provider and quality acceptance, with source verification and partial-outage cases |
| AUTH-001 | Authentication and recovery | UNVERIFIED on hosted accounts | Use isolated staging and two consenting disposable accounts; verify recovery delivery and session boundaries |
| LIB-001 | Library persistence and export | UNVERIFIED for real hosted accounts | Save, reload, link, export and delete a paper in staging; test cross-owner exact-ID denial |
| PROJ-001 | Project persistence and CRUD | UNVERIFIED for real hosted accounts | Create, edit and reload project/milestone data in staging; exercise ownership denial |
| FILES-001 | File upload, version, download and delete | IMPLEMENTED — HOSTED ACCEPTANCE INCOMPLETE | Verify real Storage bytes, version history, deletion and cross-owner denial in staging |
| EYRA-001 | EYRA model response, history and approved actions | BLOCKED: four required persistence tables absent | Verify recovery point first; review exact approved migration source/hashes; apply only after gates; then test real model, citations, persistence and two-account boundaries |
| GRANT-001 | Funding records and applications | BLOCKED: `grant_applications` absent | Review migration/dependencies and test isolated staging before any production migration |
| TEAM-001 | Teams, directory, connections, community, peer review, feedback and API tokens | BLOCKED: ten `eylo_*` tables absent | Map each feature to source, permissions and dependent migrations; validate on isolated staging |
| MEET-001 | Native meeting participants | BLOCKED: `meeting_participants` absent | Review migration dependencies; test membership and access on isolated staging |
| BILL-001 | Billing and entitlements | UNAVAILABLE; capability false | Keep disabled; prove test checkout, signed webhooks, idempotency, entitlement transitions and refunds before considering activation |
| CONTACT-001 | Contact/support delivery | UNAVAILABLE; capability false | Configure and verify the real delivery provider and support destination before enabling |
| MON-001 | Scheduled monitoring | UNAVAILABLE; capability false | Keep disabled until consent, scheduling, retries and persisted outcomes pass acceptance |
| ANALYTICS-001 | Institution analytics | UNAVAILABLE; capability false | Keep disabled until permission and aggregation acceptance passes |
| SEC-001 | Security and privacy | OPEN | Review Auth leaked-password protection setting; verify RLS and storage ownership with two accounts; complete deletion/export and legal review |
| OPS-001 | Recovery and operations | BLOCKED by missing backup/recovery evidence | Provide a current verified recovery point or access to its evidence; document restoration procedure and test it in staging |
| SCI-001 | Scientific quality | NOT SCIENTIFICALLY EVALUATED | Establish human judgments and report Precision@5, Precision@10 and nDCG@10 by domain and intent |
| BIZ-001 | Commercial validation | NOT VALIDATED | Obtain real researcher/buyer feedback and validate pricing; no traction or revenue evidence is recorded |

## Defect and blocker ledger

1. **P0 / external dependency — production recoverability.** The required current backup/recovery point is not available in connected-tool evidence. No production schema change is authorized by this tracker until recovery evidence is verified.
2. **P0 / persistence — EYRA schema.** Four EYRA tables are absent from the production catalog. Exact targeted SQL fingerprints and prerequisite checks are recorded in the previous preflight; hosted two-account acceptance remains incomplete.
3. **P0 / acceptance — private-user workflows.** Auth, cross-user RLS, real storage bytes, EYRA responses and persisted actions have not been verified with two consenting accounts in isolated staging.
4. **P1 / feature schemas.** Grant applications, team/community/directory/API-token surfaces, and meeting participants have missing tables. Historical migrations must be reviewed and staged separately; do not bulk-replay them.
5. **P1 / security configuration.** Leaked-password protection is disabled. The RLS/no-policy finding for `discovery_rate_limits` is informational and fail-closed by default; inspect its intended server-only access before deciding whether it is a defect.
6. **P2 / performance.** Thirteen unindexed foreign keys are reported. An additive source migration plus exact disposable-PostgreSQL catalog assertions are in PR #595 with CI passing; hosted application and post-migration advisor confirmation remain open.
7. **P3 / commercial operation.** Billing and contact are disabled. Monitoring and institution analytics are disabled. No live payments or external messages were initiated.
8. **Scientific/business evidence.** One real search record is not a relevance study; no user research, market traction, revenue or partnership evidence is claimed.
9. **Staging and execution environment.** The only listed Supabase development branch reports `MIGRATIONS_FAILED`; do not reset or reuse it without inspecting the failure and confirming its data/state. No local source checkout is mounted, so code edits and repository tests could not be run in this session. Source changes must resume in a checkout that can run the project's documented checks.

## Decisions and safety record

- No production DDL, data writes, new Auth accounts, secret reads, payment actions, environment-variable changes, production promotion, or external communications were performed in this execution.
- Keep production release status NO-GO until the acceptance gates and owner evidence in `docs/LAUNCH_READINESS_GATE.md` are complete.
- The task's authorized engineering scope does not replace the explicit recovery-point prerequisite for production schema changes.
- Do not describe implementation as hosted acceptance, scientific validation, security compliance, or commercial validation without the corresponding evidence.

## Exact next actions

1. Obtain or verify a current recoverable backup/recovery point for the correct production Supabase project, `kbzjngpzxpniaumlupaa`.
2. Review PRs #593–#595 and their CI evidence. Obtain a local checkout only if a new source change or deeper manual review is needed; the current code change has passed CI against the repository source.
3. Once recovery evidence is recorded, apply only the already approved targeted EYRA migration scope, then rerun schema/RLS/grant/RPC checks. Do not apply other historical migrations.
4. Diagnose the existing Supabase development branch's `MIGRATIONS_FAILED` state without resetting it; establish an explicitly isolated, healthy staging Supabase project and matching preview deployment; then run two-account Auth, Library, Projects, Files, EYRA, funding, team and meeting workflows.
5. Review and close each remaining feature, security, scientific and commercial blocker with reproducible evidence; update this tracker after each unit.

## Resume instruction

Continue from main `c7b331454d54ca72486a799994c13ca7cbec4aeb` and open PR heads #593 (`29000dc47442cf0674aec980d22d87e216a7a0bb`), #594 (`26d88a798e064d57c87f49027941ca6cc786e1dc`) and #595 (`179eb8a05e041ef1f75c3cbe8afd2e35886954d5`). First review/merge the source and documentation PRs under the repository's review policy. Then verify the production backup/recovery point for project `kbzjngpzxpniaumlupaa`; until it is evidenced, do not apply production DDL. Diagnose the existing failed Supabase development branch without resetting it, establish authorized isolated staging, then continue targeted EYRA schema acceptance and two-account workflows.