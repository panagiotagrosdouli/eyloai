# EYLO market candidate: executable acceptance and owner handoff

The first release is a research workspace, not a claim that all 77 products are complete. Preserve existing workflows and canonical tables. Keep the integration PR draft until the relevant hosted/human gates have passed. Owner access is a prerequisite, not a request to paste secrets.

## Owner access without knowing project IDs

1. Open the temporary Vercel team-access link generated in this chat, inspect the team and permissions and approve only the intended account. It expires after 10 minutes; request a new link if necessary. This grants app access, not a deployment or billing upgrade.
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
- Managed environment `ccarenv_b64_Y2NhcmVudl8yOWYxMzQ4OTkwZTA4MTkxOWZiNTAwY2VkNTQ2OTMxYg` reports remote_desktop enabled with unknown state; no desktop/cua JavaScript control tool is exposed. Shared-browser login cannot be used as a verified fallback.
- The latest recorded real-provider diagnostic is FAIL, source coverage 3/5, with Semantic Scholar429; no human relevance acceptance exists.
- No hosted registration/recovery, two-account persistence/Storage, real authenticated OpenAI, Stripe test lifecycle, LiveKit media, full account deletion, operational recovery, legal sign-off or external pilot acceptance is claimed.
- Workspace export v2 covers 30 user-owned canonical collections and profile metadata; file bytes, Auth internals, billing/provider records and backups remain excluded. Missing-table/permission/read/ownership/budget failures abort the entire export rather than silently omitting data. Deploy only with the reviewed canonical schema and preserve the explicit partial-account-data notice.
