# P0 production recovery — 2026-11-12

This report separates live observations from local code/test evidence. No deployment secrets or production data were accessed.

## Deployment identity

- Checkout was fast-forwarded to `main` commit `1804e07859fa3b75e69a1dc658242d1c2c10a573`, matching the public GitHub `main` ref at inspection time.
- `https://eyloai.vercel.app/release.json` serves release label `2026-08-10-guided-discovery-eyra-resilience` without `git_commit`.
- The cause in the checked-in build path is verified: `vercel.json` runs `npm run build`, Vite copies `public/release.json` unchanged, and only `.github/workflows/deploy-pages.yml` stamped the generated file. The Vercel build had no stamping step.
- `https://eyloai.vercel.app/api/deployment-status` returned the SPA HTML with HTTP 200, not the expected JSON API response. Other deployed functions responded as JSON. Production SHA therefore remains unknown; the live SHA cannot be compared with `1804e07`.
- The checked-in Vercel project configuration had a broad `/(.*) -> /index.html` rewrite. That rewrite can turn an API path missing from a deployment into a plausible HTTP 200 HTML response. The exact reason the production function was not matched (stale deployment artifact versus project root/build settings) remains unverified because the Vercel project is inaccessible.
- The connected Vercel account returned zero projects for both name `eyloai` and repository `panagiotagrosdouli/eyloai`. Deployment settings, build logs, aliases, and environment variable names/values could not be inspected.

The local Vercel build now stamps only Vercel's `VERCEL_GIT_COMMIT_SHA` and fails if Vercel does not provide it. It does not substitute `GITHUB_SHA`. The SPA rewrite now excludes `/api` and descendants. Smoke checks require `/api/deployment-status` to return JSON with a valid SHA matching the static release manifest and expected commit. These changes are not deployed.

## Disabled service root causes

The public capability endpoint reports all five services disabled. It intentionally returns booleans only, so it does not reveal which exact production variable is absent. The Vercel project is inaccessible; exact production environment-variable omissions cannot be identified from this session.

| Service | Verified code/config cause | Local implementation and tests | Live status |
|---|---|---|---|
| EYRA AI | Capability requires `OPENAI_API_KEY` plus valid `VITE_SUPABASE_URL`, public Supabase key, and server key for authentication and quota RPCs. The false flag proves at least one prerequisite fails; the specific one is unknown. | Server-side Responses API integration, bearer authentication, usage reservation/refund, timeout/error handling, structured-output validation, and allowlisted project tools exist. Tests use disposable/mock OpenAI and Supabase responses; no real authorized OpenAI request was made. | **Blocked by inaccessible configuration.** No live user request verified. |
| Contact | Capability requires `RESEND_API_KEY`, valid `CONTACT_TO_EMAIL`, and valid `RESEND_FROM_EMAIL`. The false flag proves at least one is absent/invalid; which one is unknown. | Resend delivery route exists. This increment validates delivery configuration and ensures honeypot submissions do not claim success. Mocked tests cover delivery acceptance, rejection, input validation, and missing config. | **Blocked by inaccessible configuration.** No real email sent. |
| Stripe Billing | Production previously reports false. The local endpoint now additionally requires `EYLO_STRIPE_TEST_MODE=1` and an `sk_test_`/`rk_test_` secret; live keys cannot enable Checkout or webhook processing. It also requires a webhook secret, both price IDs, and valid Supabase public/server credentials. | Checkout idempotency, auth, portal flow, signed webhook handling, entitlement RPC, and privacy tests exist. Local mocked Checkout test passes. Test-mode-only guard added; live payment path intentionally unavailable. | **Blocked by inaccessible test configuration and unverified migrations.** No Stripe session or payment created. |
| Scheduled Monitoring | The previous capability endpoint hard-coded `scheduled_monitoring: false`, even though `vercel.json` declares a daily cron and `/api/monitor` implements authenticated provider retrieval and persistence. | Replaced hard-coded false with explicit `EYLO_SCHEDULED_MONITORING_ENABLED=1`, `CRON_SECRET`, and valid Supabase public/server config requirements. The handler now also refuses execution unless the flag is enabled. Tests cover disabled no-database behavior, authorization, provider failures, retries, deduplication, and mocked persistence. | **Blocked pending deployment/configuration and actual scheduled-run verification.** The cron is not represented as active. |
| Workspace Analytics | An explicit operator switch is required. This increment also requires valid Supabase URL/public key before advertising readiness; the endpoint additionally validates the RPC payload. The live false value means the switch or configuration fails; exact cause unknown. | Owner-authenticated RPC endpoint, no-store behavior, shape validation, error handling, SQL RPC and grants are present. Mocked tests cover permission failures and valid/malformed results. | **Blocked pending production flag, deployed migration/grants, and live RLS acceptance.** Do not enable yet. |

## Code changes in this increment

- Vercel build-time release SHA stamping and exact-SHA public smoke gating.
- Test-mode-only Stripe configuration guard for billing and webhooks; live Stripe credentials cannot activate either path.
- Explicit, consistent scheduled-monitoring activation gate in capabilities and the cron handler.
- Shared contact-delivery readiness validation; invalid or blank service values no longer advertise availability.
- Analytics readiness now combines the operator flag with a validated Supabase project and publishable key.
- Contact honeypot submissions return an error instead of a delivery success response.
- The deployment-status function explicitly emits `application/json`; the SPA fallback no longer handles `/api` paths.

## Verification

- `npm run check`: passed on local checkout `1804e07`; imports, both TypeScript projects, ESLint, **456 tests**, and Vite production build passed. Existing dependency annotation and large-chunk warnings remain non-fatal.
- Targeted service tests: 56 passed across release stamping, contact, capability readiness, analytics, EYRA, billing, webhook, and monitoring. Monitoring/capability test updates were subsequently included in the 454-test full run.
- Release stamping tests verify exact SHA persistence, malformed SHA rejection, and that a Vercel build refuses to borrow an unrelated `GITHUB_SHA`.
- Safe public probes: landing/release/routes/capabilities return HTTP 200; `/api/deployment-status` returns HTML instead of JSON; `/api/billing` returns 503; `/api/admin-analytics` and `/api/monitor` return 401 without credentials; `/api/contact` returns 405 on GET. The strengthened production smoke now fails on both the missing static SHA and incorrect deployment-status content type.
- No authenticated browser workflow, real AI request, real email, Stripe Checkout, live scheduler run, analytics RPC, production database write, or production deployment was performed.

## External actions required

1. A Vercel team owner must grant this connection access to the Vercel project linked to `panagiotagrosdouli/eyloai` and confirm that `eyloai.vercel.app` is its production alias.
2. Deploy commit `1804e07859fa3b75e69a1dc658242d1c2c10a573` after the local changes are committed and reviewed. Confirm Vercel sets `VERCEL_GIT_COMMIT_SHA`; then run the public smoke workflow against the production alias. It must report that exact SHA.
3. In the linked Vercel project, verify environment-variable presence and intended Supabase project without sharing secret values. Configure OpenAI, Resend, and Supabase only after verifying their account/project ownership and quotas.
4. Configure Stripe test keys, test webhook signing secret, test price IDs, and `EYLO_STRIPE_TEST_MODE=1` for test-mode acceptance only. Do not configure live Stripe keys.
5. Set `EYLO_SCHEDULED_MONITORING_ENABLED=1` only after the deployed cron, `CRON_SECRET`, Supabase migrations, and a safe end-to-end scheduled run are confirmed. Set `EYLO_ANALYTICS_ENABLED=1` only after the intended database, analytics RPC migration/grants, and two-account RLS isolation pass.

## Next highest-priority task

Restore Vercel project access and deploy the reviewed commit so production identity and server configuration can be inspected. Until then, production release identity and all service activations remain externally blocked.
