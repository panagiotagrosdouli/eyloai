# EYLO account deletion — implementation and release plan

**Status: design only; account deletion is NOT implemented or enabled.**

## Dependencies before implementation

1. Connect and verify the Supabase project that backs the production EYLO deployment; do not use a similarly named but different project.
2. Confirm RLS, migration state, ownership columns and foreign keys in the real database (see `PRODUCTION_RLS_VERIFICATION_CHECKLIST.md`).
3. Inventory data categories: Supabase Auth identity/profile, projects, ideas, saved papers/researchers/opportunities, history, meetings, monitoring/watchlists, AI requests and usage, billing entitlements, Stripe customer/subscription records, logs and backups.
4. Obtain an applicable retention policy, especially for payment, tax, fraud and security records; do not promise unconditional immediate removal of all copies.

## Proposed user flow

- `Settings → Privacy → Delete account` should explain exactly what will be deleted and what must be retained, with a link to the privacy policy.
- Require a fresh authenticated session and an explicit final confirmation. Protect against CSRF/replay and rate-limit requests.
- Server-side endpoint checks the authenticated user from a verified session and must never accept an arbitrary user ID from the browser.
- Coordinate paid subscriptions/billing obligations before deleting the identity.
- Record a minimally scoped audit event; avoid storing deleted content, credentials or tokens.
- Implement an idempotent background deletion workflow with observable failures and retries.
- Sign out, invalidate sessions and show a truthful completion / pending status. Avoid claiming deletion succeeded until processing completes.

## Tests required

- A user cannot delete any other account or rows by changing request parameters.
- Anonymous, stale-session, replayed and malformed requests fail.
- Repeat requests do not duplicate billing actions.
- Partial failures are observable and safely resumable.
- All owned data collections are handled, including cascades, monitoring records and AI usage.
- Financially required retained records are described correctly to the user.
- Backups and third-party subprocessors follow documented schedules.

## Release gate

Do not ship a Delete Account button that implies completion before the above is implemented, security-tested and reviewed against the live environment.
