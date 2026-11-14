# Production configuration and service failures

A successful build does not validate server credentials, database migrations or provider access. `/api/capabilities` reports configuration presence; `ai: false` means at least one required OpenAI/Supabase setting is missing or invalid, not necessarily a bad OpenAI key.

## Diagnose without disclosing credentials

On the intended deployment's securely configured server environment, run `npm run config:check`. For local operator checks using an existing ignored env file, Node 24 supports `node --env-file=.env.local scripts/check-production-config.mjs`. The script reports missing variable **names**, invalid project URL configuration and accidentally public secrets. It never fetches a provider, writes data or prints credential values. Running it in an unconfigured checkout describes that checkout, not Vercel. Do not pull or copy production secrets solely for this check.

Required names:

- AI: `OPENAI_API_KEY`, `VITE_SUPABASE_URL`, a public Supabase key (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY`), and a server key (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`).
- Public discovery: the intended `VITE_SUPABASE_URL` and a server key. The deployed database also needs the reviewed quota RPC and correct grants.
- Contact: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `RESEND_FROM_EMAIL`, plus a verified sender domain and delivery acceptance.
- Billing: the Supabase settings above, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` and `STRIPE_FOUNDER_PRICE_ID`. Use separate test-mode credentials in staging before live activation.

All settings must target the intended Vercel environment and belong to the same system. Secrets must never use a `VITE_` prefix. After changing Vercel environment variables, a new deployment is needed; check its domain, Ready status and source identity, rather than repeating redeploys blindly.

## Discovery returns `503 DISCOVERY_RATE_LIMIT_UNAVAILABLE`

This is the application's durable quota guard failing before provider retrieval. It is not proof of a scholarly provider outage. Check server configuration first, then inspect database logs, API access and migration history on the independently identified target.

The existing `supabase/migrations/20261113113010_shared_discovery_quota.sql` defines `consume_discovery_rate_limit(text, integer, integer)` and service-role-only execution. Do not create a competing quota table or disable the guard. Reconcile the reviewed migration with target history and verify in separate staging before any production schema change. A malformed RPC result, RPC timeout, unavailable database or missing trusted client IP also fails closed; inspect sanitized server/database logs to distinguish them. Configuration presence alone does not prove the RPC works.

`npm run release:probe -- https://your-reviewed-host.example` now checks the release manifest, server provenance, capability flags and one actual OpenAlex query. It reports quota failures even if all configuration booleans are true. This is a public GET smoke check that consumes normal quota, not a scientific relevance evaluation, Auth/RLS test or release authorization.

## Hosted acceptance still required

Use the existing release runbook and evidence ledger. Two-user row/Storage isolation, real authenticated EYRA, Stripe test lifecycle, deletion/session revocation and backup restoration must be exercised on independently confirmed isolated staging. Local fixtures and configuration checks do not complete those gates. Account deletion remains explicitly staging-only in the existing implementation; do not enable it for production by flipping its feature flag.
