# EYLO staging preparation and owner configuration — 2026-11-13

## Verified access boundary

PRs #398 and #401–#403 were merged externally. This continuation starts at main `468f949`; see the latest draft continuation and verification.json. Fresh connector checks still expose only the unrelated Supabase project `supabase-cyan-car` (`umzrggayitzfgrrofjnw`). Direct lookup of owner-identified live EYLO ref `kbzjngpzxpniaumlupaa` is permission denied. The available organization is the Vercel integration organization, not an independently verified EYLO staging organization.

The connected Vercel Hobby team is `team_IUkyJtLhpTRBaUikmCSYHBDn`, slug `panagiotagrosdoulis-projects`; it exposes no linked projects. Lookup of project `eyloai` returns 404 in that scope. The original PR's Vercel check pointed to a build-rate-limit page; later deployment failures have unverified causes because scoped logs return404. This proves a failed Preview check, not a missing application or a code compilation failure. No paid plan change or production release was authorized or performed.

## Owner steps required

1. Connect Supabase access to the organization that owns EYLO. Create a **separate** staging project, using synthetic/disposable data; do not clone customer data or repurpose either ref above. Supply its project ref through secure environment configuration and confirm that it is staging.
2. Reconnect Vercel to the team/project actually owning `eyloai.vercel.app`. Verify the linked Git repository, root directory, production branch, domain, Preview settings and team ID. Restore build capacity by waiting for the account quota window or making an owner-approved plan decision. Do not keep retrying deployments while the quota rejects them.
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
