# Security policy

EYLO handles authenticated research workspaces, saved evidence, AI requests and billing-related account state. Security reports should be handled privately.

## Reporting a vulnerability

Please use GitHub's private security advisory flow for this repository rather than opening a public issue with exploit details, credentials, personal data or reproduction secrets.

Include:

- affected route, API or workflow,
- impact and realistic attack preconditions,
- minimal reproduction steps,
- whether the issue requires authentication,
- whether cross-user data access is possible,
- any logs or request IDs that do not contain secrets.

## Secrets

Never commit:

- Supabase secret/service-role keys,
- OpenAI API keys,
- Stripe secret or webhook keys,
- cron credentials,
- user access tokens.

Browser configuration may contain only intentionally public publishable values.

## Access-control expectations

User-owned data must remain protected by row-level security and ownership checks. Server-only tables and privileged operations must not be exposed through browser credentials. Changes that affect authentication, RLS, billing entitlements or server credentials require focused regression tests before merge.

## Supported branch

Security fixes target the current default branch, `main`.
