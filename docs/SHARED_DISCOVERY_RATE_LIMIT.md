# Shared scholarly discovery rate limit

The Vercel `/api/discovery` proxy applies an atomic Supabase-backed limit of 120 requests per client IP in each ten-minute window. The proxy uses Vercel's trusted `x-vercel-forwarded-for` header (falling back to Vercel's overwritten `x-forwarded-for`) and stores only an HMAC-SHA-256 digest keyed by the server-side service-role key. Raw IP addresses are not sent to or stored in Supabase by this feature.

## Deployment requirements

1. Apply `supabase/migrations/20261112_shared_discovery_rate_limit.sql` to the exact Supabase project used by the deployment.
2. Set `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel for Preview and Production. The service-role key is used only by the serverless function; never add it to a `VITE_` variable or browser bundle.
3. Redeploy the API and verify the RPC returns remaining quota headers for a permitted request, returns HTTP 429 with `Retry-After` after the threshold, and does not call a scholarly provider for limited requests.

Vercel deployments fail closed with HTTP 503 `DISCOVERY_RATE_LIMIT_UNAVAILABLE` if the trusted IP or durable limiter configuration is absent, the migration is missing, or the Supabase RPC is unavailable. This prevents an unprotected proxy from consuming provider quotas. Non-Vercel local runs do not use the serverless limiter.

The counter is atomic across instances. Old HMAC records are opportunistically removed in bounded batches after 24 hours. Service-role-only RLS and function grants prevent browser sessions from changing or reading quota state.

Automated tests exercise header selection, HMAC identity, missing configuration, RPC errors, malformed RPC output, and the HTTP 429 path with mocked Supabase/provider boundaries. They do not replace a staging migration and concurrent-request test.
