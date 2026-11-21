# EYLO release gate: verified findings and owner actions — 21 November 2026

This is a **NO-GO for commercial launch and private external pilots**. It is a read-only technical checkpoint, not permission to accept customer data, turn on contact or collect payment.

## Verified today

- GitHub `main`: `b82be92764c636ad4f9002391a9c6cfb0ffe6e4b`.
- Vercel project `eyloai`, team `panagiotagrosdoulis-projects`: latest production deployment `dpl_D2WPT9C6ig1DkcCDTCZx6W3f1UFh` is READY and was built from the same SHA. The custom production domain `eyloai.vercel.app` is verified and attached to that project. **External HTTP delivery of the domain and the public API payload was not independently verified in this environment.**
- GitHub REST reports `main` as **unprotected** (`protected: false`). Therefore passing CI is not enforced as a mandatory merge gate. Configure a branch ruleset / branch protection to require Build, EYLO Quality Gate and Product quality, block force-pushes, and require review as appropriate to the repository owner. Verify rules apply before permitting further production merges.\n- Supabase EYLO project `kbzjngpzxpniaumlupaa` reports ACTIVE_HEALTHY. Read-only PostgreSQL metadata checks show RLS enabled on all inspected public tables. Policies inspected for `projects`, `saved_papers`, `saved_researchers`, `saved_opportunities`, `notes`, `eylo_files` and `profiles` scope owner reads and writes via `auth.uid()`. This is policy inspection, **not** hosted two-account acceptance.
- Supabase security advisor: one WARN for **leaked password protection disabled**; one INFO for `discovery_rate_limits` having RLS and no policy (expected deny-by-default if it is backend-only, but verify intended access). Health advisor returns no notices. Advisor remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Vercel holds production environment variable *names* for `OPENAI_API_KEY`, Resend and Stripe. Values were **not decrypted or displayed**, and key presence does not prove valid generation, delivery or checkout.
- Recent Vercel runtime error cluster query returned no errors, but there is no assurance of traffic volume or complete log coverage. The initial runtime log query failed due to retention limits; absence of errors is not hosted functional acceptance.
- `server/capabilities.js` intentionally requires a release flag before enabling contact. Billing advertises disabled until its activation gate permits it. EYRA's `ai` flag checks configuration, **not** a real provider completion.
- There is no separately confirmed EYLO staging Supabase project among the connected projects; the available EYLO instance is live and another connected project is unrelated.

## New safe tool

Run:

```bash
node scripts/verify-hosted-release.mjs <40-character-reviewed-production-SHA>
```

This makes only two public GET requests to `/api/deployment-status` and `/api/capabilities`. It reports a mismatch, fails closed, redacts arbitrary error messages, and NEVER converts configuration flags into a pilot/launch GO decision. Run it from a network-enabled trusted CI runner or operator machine after verifying the intended domain and SHA. A match does not verify private capabilities.

## Blockers and exact exit criteria

| Gate | Current finding | Required action and proof |
| --- | --- | --- |
| GitHub release governance | Main is unprotected; accidental merges before full CI are possible | Owner configures an enforced main ruleset / required CI and reviews, then verifies it blocks a failing test PR |\n| Public production provenance | Vercel metadata SHA agrees with main; live HTTP not verified here | Execute the public probe from a network-enabled runner, record status and exact SHA, inspect desktop/mobile homepage |
| Real discovery and persistence | Fixtures exist; hosted save/reopen remains unverified | Owner-approved staging project + disposable accounts; search genuine paper, inspect DOI/source, save to Library, refresh, reopen and export |
| Two-user isolation | Source policies look owner scoped; no hosted A/B test | Confirm separate staging ref, provision two disposable consenting accounts, run `scripts/verify-rls-two-accounts.mjs`, then verify exact-ID write denials in a controlled staging environment |
| EYRA live | Key name exists, no authenticated end-to-end model/provider completion | Use `scripts/eyra-hosted-ab.mjs` in approved staging; verify provider response, citation support, explicit write confirmation and durable history |
| Contact delivery | Keys exist but public contact is intentionally gated; no inbox receipt | Owner verifies Resend sender and destination, performs controlled delivery to owned inbox, confirms support ownership/retention/triage, **then** decides whether to enable CONTACT_PUBLIC_ENABLED |
| Billing | Price ID names exist; checkout, entitlement, webhook and refund not accepted | Test complete Stripe sandbox flow with webhook signatures, tax/legal/refund review and explicit owner approval before enabling any live subscription |
| Auth security | Leaked-password protection disabled | Enable via Supabase Auth dashboard and rerun Security Advisor; retain deny-by-default policy on `discovery_rate_limits` if intended |
| Launch operations | Customer demand, costs, legal documents unverified | Real invoices/usage for financial model, legal/privacy review, support and incident ownership, documented pilot consent and test results |

## Rules

Do not test writes, impersonation or deletion against real production accounts. Do not move production DNS or promote builds merely to improve a gate score. Do not enable live billing or contact based on credentials alone. Do not change the original EYLO design. Document every staging test's SHA, environment, redacted outcome and human reviewer before considering a private pilot.
