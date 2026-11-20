# Restore the shared research connection

Observed on 2026-11-15: deployed main `6adb14e` returns HTTP503 with `DISCOVERY_RATE_LIMIT_UNAVAILABLE` for `/api/discovery`. Requests stop at EYLO's shared quota guard before scholarly providers are contacted. Discover, Researchers, personalized research feeds and research tools using the gateway share this dependency. Rewording the warning cannot restore it.

## Code repair

The server now accepts `SUPABASE_URL` as well as the existing `VITE_SUPABASE_URL`. Standard server configuration previously failed because only the Vite variable was read. If both are configured they must identify the same project; conflicting URLs fail closed. This is a tested configuration defect, not a verified diagnosis of the inaccessible production environment.

The quota remains shared and atomic. There is no browser/provider bypass or per-instance substitute. Missing keys, missing RPC, access denial and unavailable database still return503 accurately.

## Required deployment repair

In the verified EYLO Vercel project's environment settings:

1. Confirm the frontend and server project URLs identify the same intended EYLO database. Owner-identified production is `kbzjngpzxpniaumlupaa`; unrelated `umzrggayitzfgrrofjnw` must never be substituted.
2. Supply `SUPABASE_URL` (or the supported Vite URL) and a matching server-only `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`. Never place a secret in a `VITE_` variable or send it in chat. Check Production and Preview scopes independently.
3. Inspect runtime log classification `EYLO_DISCOVERY_QUOTA_UNAVAILABLE`: `missing_server_configuration`, `missing_trusted_client_ip`, `rpc_not_found`, `rpc_access_denied`, `rpc_http_error`, `rpc_timeout`, `invalid_rpc_response` or `rpc_network_error`. Logs contain only classifications/status, no request contents or keys. This distinguishes missing configuration from missing schema.
4. Inspect the correct database's migration history and `consume_discovery_rate_limit` RPC before SQL changes. The reviewed source is `supabase/migrations/20261113113010_shared_discovery_quota.sql`. Confirm service-role execution permission and private `discovery_rate_limits` table. Test any missing migration in separately verified staging first; no blind production push.
5. Deploy the reviewed code with the corrected runtime settings, then probe `/api/discovery` for all supported providers. Successful responses, genuine provider-specific failures and429 exhaustion must remain distinguishable. Verify public Discover and authenticated research pages in a browser. Unrelated AI/provider credentials are not required for public scholarly retrieval.

## Access blocker

Fresh connected checks list no EYLO Vercel project, including under team `team_IUkyJtLhpTRBaUikmCSYHBDn`, and Supabase still exposes only the unrelated project. Deployed environment values/logs and correct RPC cannot currently be inspected or repaired. No remote environment change, migration or production deployment was performed. The live outage is not certified fixed.
