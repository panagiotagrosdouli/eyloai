# EYRA deployment runbook

## Required configuration

- `VITE_SUPABASE_URL`: explicit HTTPS Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` (or supported anon-key alias): public key for the configured project.
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: required by existing EYRA usage reservation and quota RPC path; never send this key to the browser.
- `OPENAI_API_KEY`: server-only Responses API key.
- Optional `OPENAI_MODEL`; otherwise the existing default is used.
- Stripe secrets and price IDs are required for billing entitlement enforcement; without complete billing configuration, the existing code treats EYRA as free tier.

## Before deploying

1. Review the focused branch and confirm it targets the intended repository and `main`.
2. Run `npm run check:imports`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
3. Deploy a preview and test with a disposable authenticated user: list projects, create one with an explicit request, verify its UUID and row, then confirm a second user cannot read it.
4. Ask EYRA to save a retrieved DOI paper. Verify the title against Crossref and confirm the record appears once in the same user's Library.
5. Verify billing configuration and the free-plan project limit against the intended Supabase project.
6. Confirm production URL, deployed commit, and authenticated endpoint behavior before communicating availability.

## Recovery

If OpenAI fails before a tool call, no project operation should have run. If a Supabase write succeeded but the OpenAI follow-up fails, the database row is authoritative; query it through the authenticated project view before retrying to avoid duplicates. The current implementation does not provide durable idempotency keys or a separate action-history screen.
