# EYLO staging preparation and owner configuration — 2026-11-13

## Verified access boundary

PRs #398 and #401–#405 were merged externally; batch9 starts from main `68271db`. Current continuation is draft [#407](https://github.com/panagiotagrosdouli/eyloai/pull/407). Fresh connector checks still expose only unrelated Supabase `supabase-cyan-car` (`umzrggayitzfgrrofjnw`). Owner-identified live EYLO `kbzjngpzxpniaumlupaa` must never be staging.

The connected team is `team_IUkyJtLhpTRBaUikmCSYHBDn`, slug `panagiotagrosdoulis-projects`; it exposes no EYLO projects or commit-filtered deployments. GitHub reports Vercel SUCCESS for batch9 head `13a8117`, while its explicitly scoped deployment lookup returns404. The historical build-rate-limit and later failed checks do not explain this successful status, and source/environment identity remains unverified. Upstream function consolidation is preserved. No paid change, manual deployment or production release was performed.

## Owner steps required

1. Connect Supabase access to the organization that owns EYLO. Create a **separate** staging project, using synthetic/disposable data; do not clone customer data or repurpose either ref above. Supply its project ref through secure environment configuration and confirm that it is staging.
2. Reconnect Vercel to the team/project actually owning `eyloai.vercel.app`. Verify the linked Git repository, root directory, production branch, domain, Preview settings and team ID. Inspect current build logs/quota before diagnosing any new rejection. Do not treat historical rate limits as the cause of a later result or repeatedly redeploy while a quota rejects builds.
3. Link a separate Vercel staging project/Preview target to this integration branch. Use `vercel.staging.json`, which excludes APIs from the SPA fallback, has no hardcoded production Supabase rewrite, disables automatic crons and runs the staging target preflight before building.
4. Configure `EYLO_ENVIRONMENT=staging`, `EYLO_STAGING_SUPABASE_REF`, `EYLO_STAGING_CONFIRMED_REF` (the same explicitly confirmed staging ref), `VITE_SUPABASE_URL` (its exact official HTTPS URL), `VITE_SUPABASE_ANON_KEY` (public key), and `VITE_SUPABASE_USE_PROXY=false`. Never paste secrets in chat or commit them.
5. Configure the staging-only server credentials needed for the features under test: Supabase server key/usage RPC, OpenAI model/key, scholarly provider key/contact, Stripe **test-mode** keys/prices/webhook, and LiveKit staging URL/key/secret. Keep each secret server-only. Missing credentials must leave capabilities unavailable. This environment currently has no usable OpenAI API key, so no live model call is claimed.
6. Once connector metadata, owner confirmation and the Preview configuration independently match the **same staging ref**, inspect the deployed schema and migration history. Apply each reviewed migration once to staging only; then run database advisors and the complete two-account acceptance tests. Local PostgreSQL runs do not satisfy this step.
7. Create two disposable staging accounts and securely configure the existing opt-in browser/RLS tests. Verify actual registration/recovery email, persistence, file bytes/versioning/Storage ownership, workplans, EYRA, Stripe test lifecycle, two-user media, account deletion and privacy. Do not weaken the existing prohibition on using live EYLO for staging writes.
8. Confirm deployment identity: build stamping now puts the Vercel Git SHA into `dist/release.json`. Compare that SHA with the reviewed PR head and `/api/deployment-status` before accepting a Preview. A generic HTTP 200 or an old release label is insufficient.

## Prepared locally

- `scripts/verify-staging-config.mjs` rejects live/unrelated refs, mismatched URLs, unconfirmed refs, production builds, the legacy proxy and server keys in public configuration. It performs no remote calls or migrations.
- `vercel.staging.json` is a separate candidate configuration; it does not change the live project.
- `scripts/integration/test-local-postgres.py` creates an isolated, randomly named, network-disabled PostgreSQL container and removes only that container. Synthetic Auth identities and Storage metadata are compatibility fixtures, not hosted service acceptance.

Status: configuration and guards prepared; **hosted staging provisioning/access, migrations and live acceptance BLOCKED** pending owner-controlled access and identity confirmation. The current continuation must remain draft until blockers are resolved.

## Batch9 staging activation checklist

Review `supabase/migrations/20261113180517_complete_workspace_products.sql` alongside the existing migration history; it is a proposal, not remotely applied. The disposable runner executes19 selected migrations, not the full historical chain. The new collaboration tables require hosted two-account RLS/consent/revocation tests. Team membership deliberately grants no private project/file access.

Administrative access uses fresh Auth and current `auth.users.raw_app_meta_data`, active `auth.sessions`, and account ban state. Assign a test administrator only through approved server-side staging administration, never editable user metadata; verify role/session revocation immediately. Test developer tokens against staging only: raw token shown once, persisted digest only, owner/project scopes, expiry/revoke/ban and shared quotas. Keep Supabase server credentials outside public/browser variables.

Run actual authenticated translation/interview streams only with authorized staging provider credentials and budgets; synthetic responses do not establish quality. Confirm encrypted Offline preparation/reload/signout cleanup on supported browsers. Per-page collaboration export covers only loaded authored contributions; full privacy export/deletion with Auth, provider records, file bytes and backups remains a release gate. Never enable public/community features for real users before moderation, policy and privacy acceptance.
