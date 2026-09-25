# Authentication and security audit

_Last reviewed: 2026-09-25._

## Current findings

| Severity | Area | Risk addressed | Current implementation | Verification |
| --- | --- | --- | --- | --- |
| High | Return destinations | Open redirects after login, OAuth or recovery. | `getSafeRedirect` accepts only known internal workspace routes, including `/labs/*`, and rejects external, protocol-relative, malformed and backslash-based destinations. | Covered by `tests/auth-security.test.mjs`. |
| High | Authentication state | Contradictory UI/session states and protected-content flashes. | `AuthContext` centralizes loading, authenticated, anonymous, configuration-error and error states. | Existing EYRA/auth configuration smoke checks remain in CI. |
| High | User-data isolation | Cross-user access through browser credentials. | Supabase migrations enable row-level security and ownership policies for user-scoped entities. Server-controlled tables are restricted to privileged roles. | SQL policies are versioned in `supabase/migrations`; live cross-user tests are still required. |
| Medium | Auth API usage | Direct provider calls scattered through pages. | Sign-in, registration, OAuth, magic link, password recovery, password update and callback session checks route through `src/lib/supabase/auth.js`. | Auth callback no longer reads the Supabase client directly. |
| Medium | Error disclosure | Raw provider messages leaking to users. | `src/lib/supabase/errors.js` maps provider failures to stable product-safe messages. | Error mapping has regression coverage. |
| Medium | Startup configuration | Missing environment variables causing ambiguous failures. | Startup environment validation renders configuration-safe states without exposing secret values. | Existing service-key/config checks remain in CI. |

## Remaining production verification

- Run authenticated cross-user read, update and delete tests against a configured Supabase project.
- Exercise OAuth callback and password-recovery flows end-to-end in the production redirect configuration.
- Add browser-level tests for session expiry, sign-out and protected-route transitions.
- Run Supabase security/database advisors after schema or policy changes.
- Keep service-role/secret keys server-only and use only publishable browser credentials.
