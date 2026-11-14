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

## Current migration-plan guard (2026-11-14)

`npm run db:review-plan` verifies all28 SQL source hashes and explicitly lists the21 files replayed in disposable PostgreSQL plus7 exclusions. The local runner now invokes this guard before starting a database. This is not permission or a ready-to-push remote migration plan. The legacy scheduler contains a live EYLO URL and must not run in staging; duplicate legacy version20260803/native-schema assumptions require target-history reconciliation. Follow the current [owner runbook](release/MARKET_READINESS_RUNBOOK.md) and never substitute a blanket push or a competing schema for that review.

## Batch9 staging activation checklist

Review `supabase/migrations/20261113180517_complete_workspace_products.sql` alongside the existing migration history; it is a proposal, not remotely applied. The disposable runner executes19 selected migrations, not the full historical chain. The new collaboration tables require hosted two-account RLS/consent/revocation tests. Team membership deliberately grants no private project/file access.

Administrative access uses fresh Auth and current `auth.users.raw_app_meta_data`, active `auth.sessions`, and account ban state. Assign a test administrator only through approved server-side staging administration, never editable user metadata; verify role/session revocation immediately. Test developer tokens against staging only: raw token shown once, persisted digest only, owner/project scopes, expiry/revoke/ban and shared quotas. Keep Supabase server credentials outside public/browser variables.

Run actual authenticated translation/interview streams only with authorized staging provider credentials and budgets; synthetic responses do not establish quality. Confirm encrypted Offline preparation/reload/signout cleanup on supported browsers. Per-page collaboration export covers only loaded authored contributions; full privacy export/deletion with Auth, provider records, file bytes and backups remains a release gate. Never enable public/community features for real users before moderation, policy and privacy acceptance.

## Batch10 acceptance additions

Verify Settings workspace v3 with populated disposable rows in all40 collections. Export must include only authored/owned contributions and the caller's membership rows, omit token digests/raw credentials, and abort entirely on a read/ownership/account-change failure. Directory uses user_id as its primary key. The private two-account read-denial CLI deliberately probes profiles plus30 private tables; shared collaboration needs separate consent/role-specific tests. A missing proposed schema fails export rather than silently producing an incomplete file.

Test all-day conference deadlines in UTC-negative/positive browser timezones and across month/DST boundaries, including editing and exclusive-end spans. Verify translation marker-integrity failure blocks saving; it does not replace real-provider language/source review. Form CSV must export saved responses only and neutralize formula prefixes. Full Auth/provider/file-byte/privacy deletion and scholarly relevance acceptance remain unresolved.

## Batch11: actual source coverage and privacy activation

The latest real-provider diagnostic through the local candidate handler passes all five source-coverage cases and all five anchor gates (mean0.94); Semantic Scholar429 is still explicitly unavailable. This is automated real retrieval, not human relevance approval or hosted EYRA acceptance.

The new privacy implementation is deliberately restricted to **isolated free-account/password staging with no Stripe secret/webhook configured**. After independent identity confirmation, review/apply existing billing migration `20260811053718_production_billing_entitlements.sql` once if missing, then proposal `20261114063216_account_deletion_lifecycle.sql` once. Run hosted advisors; local21-migration SQL evidence is not a substitute. Configure only server-side `EYLO_PRIVACY_DELETION_ENABLED=true` and a strong `EYLO_PRIVACY_WORKER_SECRET` (at least32 characters), alongside the existing staging/Supabase server configuration. No feature activates from the example file, a public VITE variable or a successful build.

Follow [the deletion contract](integration/ACCOUNT_DELETION_CONTRACT.md): fresh password proof, typed/cancelled consent, private receipts, service-only leased recovery and actual two-account Storage/Auth acceptance. Set up a reviewed worker for abandoned confirmed jobs; staging crons remain disabled. Accounts with billing links, configured Stripe, verified MFA or passwordless sign-in require additional implementation/review. Do not set a gate to PASS for tests that cannot execute. No production data or live payment action is authorized by this configuration.
