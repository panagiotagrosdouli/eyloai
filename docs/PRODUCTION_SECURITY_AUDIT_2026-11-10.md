# EYLO production security audit — 2026-11-10

## Scope and evidence

Repository baseline: `main` commit `b1709d02ad93542014b8458ff3d23d363d75ac32`. Draft PR #292 changes are **not deployed** at the time of this assessment. Independent auth race correction is in draft PR #293.

A public HTTPS probe executed using GitHub Actions on a GitHub-hosted runner. The production response was `HTTP/2 200`; CA verification passed using curl's normal TLS validation. HTTP returned `308` redirect to `https://eyloai.vercel.app/`. Live HSTS was `max-age=63072000; includeSubDomains; preload`. No application-specified CSP, X-Frame-Options, X-Content-Type-Options or Referrer-Policy was observed in that response. The new headers in this PR require deployment and remeasurement before claiming they are live.

The public root response included `Access-Control-Allow-Origin: *`. This is not evidence that authenticated APIs allow cross-origin credentials; inspect API endpoint CORS separately. The server-side CORS allowlist is implemented in `src/lib/api-cors.mjs`, and no credentialed wildcard was found there.

## Confirmed source-code issues and corrections in PR #292

1. **Cross-project proxy risk.** `vercel.json` rewrote `/supabase/:path*` to a fixed tenant while the browser could select a proxy based on an environment flag. The redirect could not be relied upon to track an intentionally configured future project. Removed both rewrite and browser proxy fallback. The browser must now use the configured Supabase HTTPS origin directly.
2. **Missing explicit baseline application security headers.** Added framing denial, MIME sniffing protection, referrer restriction, narrowly scoped CSP restrictions, device API policy, and HSTS matching the stronger live Vercel header. Full restrictive script/style/connect CSP is not applied without browser compatibility evidence; blocking necessary app traffic could break login and research tools. Stronger CSP requires staging and smoke testing.
3. **Dynamic CORS accepted HTTP origins when hostname matched.** Changed dynamic preview allowance to HTTPS-only and left the explicit local development and public GitHub Pages origins intact. The actual request hostname must match exactly.
4. **No default no-store header in shared API CORS helper.** Set a noncacheable default for API handlers, permitting an endpoint's intentional public-cache policy to override it.

## Actual tests

- GitHub Actions security audit: `npm audit --omit=dev --audit-level=high` reported **0 vulnerabilities** in the first completed run. Expanded full-tree audit is pending a subsequent run.
- GitHub runner HTTPS probe: **passed** CA-valid HTTPS root and 308 HTTP-to-HTTPS redirect. Exact TLS protocol/cipher and certificate verification are added for the next run.
- Production changes to TLS, headers, redirects, and CORS: **not deployed / not yet verified in production**.
- First security PR CI run identified failures in eight monitoring tests caused by a response mock without `setHeader`. Corrected the no-store integration; subsequent CI must pass.
- Browser E2E for real user login, email confirmation, password recovery, session persistence and OAuth: **unverified**.
- Supabase provider encryption at rest and actual dashboard auth configuration: **unverified**.

## Supabase project and RLS access blocker

Repository `.env.production` identifies `https://kbzjngpzxpniaumlupaa.supabase.co` with a public publishable key. The connected Supabase account exposes only inactive, unrelated project `umzrggayitzfgrrofjnw`; it is NOT evidence that the production project has been changed or misconfigured. No SQL was run against the unrelated project. We cannot inspect the intended project's actual policies, storage, auth URL allowlist, or encryption settings from this connection.

The checked-in migrations define owner-bound RLS for private tables and a restricted internal analytics RPC; applied database state is **unverified**. `scripts/verify-rls-two-accounts.mjs` performs *read-only* owner/cross-owner checks with two authorized disposable identities, refuses to run against a different project, and reports empty owner-fixture tables as inconclusive. It was not executed against live accounts because credentials were unavailable.

## Secret and browser-token handling

Inspected frontend Supabase configuration references a publishable key, not a service-role secret. Backend handlers use server environment variables for privileged keys. A repository inspection cannot rule out leaked historical secrets or values from uninspected deployment bundles. Search history/secret scanning and Vercel environment inspection remain needed.

Supabase JS enables persisted sessions and token auto-refresh in the browser. In an SPA, refresh tokens accessible to JavaScript are exposed if the origin experiences XSS; the new CSP baseline reduces selected injection surfaces but does not replace complete DOM sanitization or a strict script CSP. Do not claim HttpOnly authentication cookies are used. No cookie-based session implementation was verified.

## Remaining release blockers

- Verify intended Supabase project and redirect/email settings with authorized dashboard access, without switching projects.
- Use authorized test accounts to complete Sign Up -> Confirm -> Login -> Workspace -> Refresh -> Logout -> Login -> Recovery, then repeat cross-user queries and mutations only in disposable fixtures with explicit authorization.
- Verify provider-managed encryption at rest and HTTPS between serverless backend and Supabase; inspect settings or documented provider assurances.
- Verify live CSP, HSTS, headers and auth API CORS on a reviewed preview, not just source configuration.
- Review dependency and full GitHub secret-scanning results, if available, and address any findings.
- Do not merge PR #292/#293 until their relevant CI checks and reviews pass. No billing, project switching, security bypasses or production database modifications were performed.
