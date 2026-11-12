# Public discovery rate limiter: staging and release runbook

## Policy and fairness

The API applies one distributed token bucket to each public egress network: capacity **60 uncached proxy requests**, refilling at **one request per second**. This removes the fixed-minute reset burst while keeping the existing 60/minute sustained ceiling. Cached successful responses remain available through the existing CDN policy without invoking the function or database limiter; cache misses consume a token.

One Public Discovery action fans out to as many as five paper indexes plus researcher and institution endpoints. A cold search can therefore use about seven proxy requests, giving a shared network roughly eight cold full-search actions per minute at the sustained ceiling. This is an upper-bound estimate from the current client fan-out; cache hits and pages that omit a source reduce consumption. A public IPv4 NAT and an IPv6 /64 subnet share their respective bucket. IPv6 /64 grouping reduces quota evasion through temporary interface addresses, which RFC 8981 explicitly allows to rotate, while also making a campus subnet share the limit.

Universities, libraries and other shared networks can therefore receive 429s when simultaneous uncached use exceeds the ceiling. The limit is intentionally unchanged until staging and production telemetry measures actual 429 frequency, shared-network concentration and source-provider cost. Before proposing a different ceiling, collect at least two weeks of aggregate status/latency and 429 data across a representative academic term, compare normal peaks with sustained abuse, and test the candidate against provider quotas. Do not log client IPs, HMAC values, research queries or authorization headers for this analysis.

Public discovery currently accepts anonymous requests, so it cannot apply an authenticated-user quota. Do not add a cookie or an unverified JWT as an identity. A later per-account control would first need server-side Supabase token verification and a policy that treats the per-user quota and network abuse ceiling as separate dimensions. It should not silently replace the network control.

The database stores only a versioned HMAC-SHA256 of the bucket identity. IPv4-mapped IPv6 is normalized to the same IPv4 bucket. Native IPv6 addresses are grouped to /64. Keys are server-only, must contain at least 32 random bytes, and are never sent to the browser. Rows are removed after 24 hours without requests; the five-minute cleanup schedule means actual deletion is within approximately 24 hours and five minutes of last use. Replacing the HMAC secret resets active buckets; rotate only through a planned change or suspected compromise, record that the reset can grant each network a fresh burst of up to 60 requests, and monitor the rollout. Never print the secret or counter hashes.

## Preconditions

The handoff and migration have not been validated against a live project. Do not run these steps against production. Use the service owner's explicitly authorized staging Supabase project and its matching Vercel Preview deployment.

1. Confirm the repository is `panagiotagrosdouli/eyloai`, identify the intended staging project ref with its owner, and compare it with the staging dashboard URL. The script requires the same 20-character project ref in `SUPABASE_STAGING_PROJECT_REF` and the configured `VITE_SUPABASE_URL`.
2. Inspect staging for an existing `private.discovery_rate_limit_counters` relation, an existing `public.consume_discovery_rate_limit` function, the `pg_cron` extension, and a job named `eylo-discovery-rate-limit-cleanup`. Inspect whether the schema `private` is already used. This migration only owns the specifically named table, functions and Cron job; it must not be used as a reason to drop or replace other private-schema objects.
3. Check the rollback SQL below and take the normal staging backup/snapshot required by the project owner. This table contains only short-lived HMAC bucket identifiers, not user research data.
4. Apply `supabase/migrations/20261112063310_discovery_rate_limits.sql` to staging only. Verify that the RPC is executable by `service_role`, not `anon` or `authenticated`; verify RLS is enabled; inspect the Cron job and its run history.
5. Set `VITE_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or the existing legacy `SUPABASE_SERVICE_ROLE_KEY`) and a newly generated `DISCOVERY_RATE_LIMIT_HMAC_KEY` only in the staging server environment. Generate the HMAC key in an approved secret manager (or with `openssl rand -base64 32`) and enter it directly into the server-only environment. Never set keys as `VITE_*`, client-side variables or public build arguments. Confirm values are present without printing them.
6. Deploy the staging backend after those dependencies are ready. Missing configuration and database failures intentionally produce uncached 503 responses for uncached requests. Do not promote this code to production without a verified migration and environment configuration.

## Staging verification

Run the DB-level concurrent/boundary test against the confirmed staging project. It requires a unique test hash, creates no raw IP or research query record, and leaves one pseudonymous row to expire automatically.

```bash
SUPABASE_STAGING_ACKNOWLEDGED=I_AM_AUTHORIZED_TO_TEST_STAGING \
SUPABASE_STAGING_PROJECT_REF='<confirmed-20-character-staging-ref>' \
VITE_SUPABASE_URL='https://<confirmed-ref>.supabase.co' \
SUPABASE_SECRET_KEY='<staging-only-server-secret>' \
DISCOVERY_RATE_LIMIT_HMAC_KEY='<staging-only-random-secret-at-least-32-bytes>' \
npm run test:discovery-rate-limit:staging
```

The staging script drives 30 concurrent RPC calls at one controlled timestamp with capacity 10 and a 2-second refill period. Exactly 10 must pass. It then verifies `Retry-After`, token refill, recovery after the full period, and that older timestamps cannot rewind an active counter. Local API tests separately verify that a full production-sized 60-request bucket returns HTTP 429 with `Retry-After`, that limiter failure returns uncached 503 without calling a provider, and that provider 429 remains attributed to the provider.

Also verify from the staging website/API:

- One end-to-end search returns live (not fabricated) records from OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar where each provider has matching records; verify partial-source state when a provider is unavailable.
- Repeat the same query and confirm successful CDN-cached results remain available without consuming additional origin requests.
- From a controlled test client, issue 60 distinct cache-miss queries inside a minute and confirm successful proxy responses when providers are healthy; the next cache miss must be HTTP 429 with a positive `Retry-After` no greater than 60 seconds. The 60 requests contact real provider APIs, so run this only in staging, with provider terms/quotas observed, and never in production.
- Wait for refill, retry and verify discovery recovers. Then test a missing RPC table and a temporarily unavailable staging RPC. Each must return uncached 503 without attempting provider access; restore the migration/service and verify recovery.
- Exercise saved evidence, Research Gap Finder, and follow-up discovery with the retrieved record IDs. Confirm that source links/citations remain source-backed and that errors never become invented empty-result claims.
- Verify the Cron run history and that an idle test counter is deleted after retention. Confirm normal active counters are not deleted while being refreshed.

## Rollback and recovery

If staging acceptance fails, keep production unchanged and roll back the staging deployment to its previously verified commit. Restore staging API availability/configuration before retrying. Do not weaken the runtime fail-closed behavior as a recovery shortcut.

If the migration itself must be rolled back, first stop the staging deployment that calls the RPC. Then run the following only after confirming the named objects were created for EYLO and contain no other team's data. Do not drop the shared `private` schema or the `pg_cron` extension.

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'eylo-discovery-rate-limit-cleanup';

drop function if exists public.consume_discovery_rate_limit(text, integer, integer, timestamptz);
drop function if exists private.purge_discovery_rate_limit_counters();
drop table if exists private.discovery_rate_limit_counters;
```

If the migration or credentials become unavailable after release, cached successful scholarly responses can continue under their existing CDN TTL/stale policy; uncached requests fail closed. Restore the intended Supabase connection, RPC/table, HMAC secret and Cron job, then verify recovery on staging before changing production. HMAC rotation invalidates all existing buckets; keep the replacement server-only and do not use the old key after suspected compromise.

## Release sequence and monitoring

1. Identify and record the intended Supabase staging project and production project separately.
2. Review the migration, private-schema grants, Cron permissions and the rollback SQL; validate it in staging.
3. Apply the migration in staging, configure staging secrets and confirm the values by presence only.
4. Run the staging RPC concurrency tests and the live application acceptance checks above.
5. Review the actual production environment configuration with the service owner; do not use staging credentials in production.
6. Deploy the code only after production migration and server-only secrets are ready, with the expected commit SHA recorded.
7. Observe Vercel function status/latency, HTTP 429/503 rates, Supabase RPC latency/errors and Cron run history. Aggregate only; do not log query text, IP addresses, hashes or bearer credentials.
8. Verify the production release SHA and a normal scholarly query, then continue monitoring for 429 clustering among university/shared egress networks.

If the project cannot expose those metrics without collecting sensitive values, add privacy-preserving aggregation before tuning limits. Rollback means returning the application to the last verified commit while retaining the migration until no deployed code calls its RPC; do not drop the database objects while an active deployment still depends on them.

## References

- [Vercel request headers](https://vercel.com/docs/headers/request-headers) — Vercel overwrites `x-forwarded-for` and documents `x-vercel-forwarded-for` as its client IP header.
- [Supabase Cron](https://supabase.com/docs/guides/cron) — `pg_cron` scheduling and job-run history.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) — rate limits should be fitted to business and provider limits.
- [RFC 8981](https://www.rfc-editor.org/rfc/rfc8981.html) — IPv6 temporary interface identifiers can rotate over time.
