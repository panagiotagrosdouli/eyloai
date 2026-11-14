# EYLO market candidate: executable acceptance and owner handoff

The first release is a research workspace, not a claim that all 77 products are complete. Preserve existing workflows and canonical tables. Keep the integration PR draft until the relevant hosted/human gates have passed. Owner access is a prerequisite, not a request to paste secrets.

## Owner access without knowing project IDs

1. Reconnect Vercel from the app connection settings using the account/team that owns EYLO. The visible team is `panagiotagrosdoulis-projects` (Hobby), but its connector lists no linked projects. Open the existing EYLO dashboard project and verify its repository binding. Do not rely on old temporary access links; reconnecting grants app access, not deployment or billing authorization.
2. In the existing Supabase app connection settings, reauthorize the account/organization that can see the EYLO project. The current connection exposes only the unrelated Vercel-integration organization. Never repurpose its database. The existing EYLO ref is live, not staging.
3. Once the intended organization/team is visible, verify repository, domain and project identity, then prepare a separate synthetic-data staging project and matching Preview. Follow `docs/STAGING_OWNER_CONFIGURATION.md`. Do not create a project in an unrelated organization, infer credentials, change plans, or apply remote migrations before identity/access are confirmed.
4. Configure keys only through secure environment/project settings. Never put credentials in chat, Git, public Vite variables, test output or evidence artifacts. Use Stripe test mode and a staging media service. Legal controller/contact, support responsibility and retention/deletion policy require owner review; do not invent them.

## Evidence contract

Use `docs/release/market-readiness-evidence.json` as a NOT_RUN template. Produce actual acceptance artifacts outside the checked-in template for the exact candidate commit; reports can live under `docs/release/evidence/` or reference exact GitHub Actions runs. A report containing its own commit should be generated after checkout/testing and kept as an artifact, not committed with a self-referential SHA.

For every gate provide PASS only after execution, the required scope, exact commit, UTC execution time, artifact reference, accountable reviewer and all required assertions. Hosted reports must name the same independently verified staging ref and Vercel project. Isolation/media/privacy need two distinct disposable users. Research needs at least five sufficiently covered real-provider queries plus independent human review of those queries. Stripe must explicitly report test_mode=true and livemode=false. All gates require current evidence within 7 days. These are compatibility checks on reviewed reports, not cryptographic attestations or independent reruns.

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:auth
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:learning
python scripts/integration/test-local-postgres.py
# Current default is intentionally NO-GO / exit 1. It performs no remote calls.
npm run release:readiness
# After real acceptance, evaluate its sanitized artifact from the exact candidate checkout.
npm run release:readiness -- /path/to/real-candidate-evidence.json
```

Local fixtures, disposable PostgreSQL, hosted staging, real public-provider calls, human review and production observations are different scopes. Do not relabel one as another. A complete compatibility result is READY_FOR_OWNER_REVIEW, not permission to deploy. Production migrations/promotion and live payments require a separately reviewed rollout, backup/recovery plan and explicit owner authorization.

## Current constraints

- Connected Supabase access still excludes live EYLO and no separate staging project is connected.
- The connected Vercel team lists no EYLO project; project and deployment logs return404. Earlier quota failures do not establish the cause of later deployment failures.
- Current main3854e98 is identified by public browser/server provenance after externally merged PR412. Its public day/night/Premium navigation passed an anonymous read-only browser check. This does not establish ownership/access or private product acceptance.
- Fresh real-provider diagnostics through the local candidate handler pass5/5 source coverage and5/5 heuristic anchor gates (mean0.94), with Semantic Scholar429 disclosed. Hosted proxy diagnostics fail0/5 before reaching providers: HTTP503 `DISCOVERY_RATE_LIMIT_UNAVAILABLE`. No human relevance acceptance exists. See [batch12](../integration/batch-12-core-acceptance.json).
- No hosted registration/recovery, two-account persistence/Storage, real authenticated OpenAI, Stripe test lifecycle, LiveKit media, full account deletion, operational recovery, legal sign-off or external pilot acceptance is claimed.
- Workspace export v3 covers40 owned/authored canonical collections and relevant membership/profile metadata; file bytes, received third-party contributions, Auth internals, billing/provider records and backups remain outside this bounded export. Missing-table/permission/read/ownership/budget failures abort the export rather than silently omitting data. Universal owner-denial isolation remains scoped to private collections; collaboration uses its own explicit consent/role contracts.

## Public deployment identity probe

Run `NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1 npm run release:probe` in this managed environment (or `npm run release:probe` with direct network access). It only GETs public release, deployment-status and capabilities JSON and expects the current checkout SHA. A feature checkout is intentionally different from deployed main. HTTP200 HTML, missing/mismatched SHAs or disabled AI/contact/billing fail the probe. Even a pass does not prove ownership, hosted acceptance or market readiness. The latest explicit-main comparison matched3854e98 in both JSON endpoints but failed the capability requirements. Earlier SPA HTML failures are historical.

## Hosted discovery503: owner-side configuration checks

Observed14 November2026: `/api/discovery` returns503 with code `DISCOVERY_RATE_LIMIT_UNAVAILABLE` across providers. This is an EYLO quota-service failure, not evidence that every scientific index is down. The read-only public response cannot distinguish missing private configuration, an inaccessible RPC, a denied RPC call or unavailable trusted client-IP metadata.

After independently verifying a separate staging project and matching Vercel Preview:

1. Verify the runtime `VITE_SUPABASE_URL` is that staging project's official HTTPS URL. Keep its publishable key public and its matching `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` private in secure server environment settings. Never put an admin key in a `VITE_` variable or chat.
2. Review the existing canonical migration sequence. The one shared quota RPC is defined in `supabase/migrations/20261113113010_shared_discovery_quota.sql`; do not create a competing limiter or apply it twice. Remote migrations remain prohibited until staging identity/access is verified.
3. Verify `consume_discovery_rate_limit(text, integer, integer)` and its table exist in staging, and only `service_role` has privileged RPC execution. Do not solve permission failures by granting it to anonymous/authenticated clients.
4. Confirm trusted Vercel forwarding metadata reaches the deployed handler. Do not accept caller-controlled IP overrides or remove the fail-closed quota check.
5. Retest the hosted proxy with the unchanged five-query diagnostic, then conduct independent human relevance review. A direct-provider/local-handler pass does not satisfy hosted proxy acceptance.

Production configuration, migrations and promotion still require a separate explicit owner authorization after staging acceptance. This batch changed none of them.

## Do not treat the local replay as a remote migration plan

Run `npm run db:review-plan` before planning database changes. It accounts for all28 repository SQL files, verifies their pinned contents and drives the same21-file selection used by the disposable PostgreSQL runner. Seven files are explicitly excluded pending schema/history or side-effect review. Exit0 means only that the local manifest is intact; `remote_application_authorized` and `remote_history_verified` remain false.

The historical `20260817091000_scheduled_monitoring.sql` configures Vault/pg_cron/pg_net and embeds the live EYLO function URL. It must not be replayed into synthetic staging. The two `20260803_*` files share a legacy version prefix; nonstandard timestamps and existing native-schema dependencies must be reconciled against the actual authorized target's migration history. Do not silently rename applied migrations, create duplicate schemas or run `supabase db push` across all28 files. No historical SQL was rewritten or remotely applied by the guard.
