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


## Partial research-workspace export proposal (2026-11-05)

A draft implementation adds **Settings → Privacy → Download saved workspace**.
It reads the verified user's profile and ten owner-scoped research tables via
Supabase and downloads a JSON file **in the user's browser**. This is a
convenience export, not a complete Art. 15/20 GDPR request fulfillment or
account deletion. It does not include billing, third-party or server logs,
Auth internals, backups or retention records; the UI states those limitations.
The export fails without downloading a partial file if any table is inaccessible,
an expected row owner is wrong or pagination is unstable.

Live acceptance requires the **real EYLO production Supabase project**,
a disposable account with records across multiple pages, and a browser test.
The currently connected unrelated project must remain untouched.


### Client-side export resource limits (release candidate enhancement)

The in-browser partial workspace JSON download applies a 50-MiB final JSON
size ceiling and a 50,000-record combined ceiling (in addition to the
per-table ceiling). Both the accumulated UTF-8 row sizes and the final
payload including account metadata are checked. If a limit is exceeded,
**no partial file is produced**; the UI tells the user to contact support
for an alternative personal-data access pathway. This guard limits browser
memory exhaustion but does not satisfy a complete data-access request;
support and legal/privacy procedures must address legitimately large exports.
