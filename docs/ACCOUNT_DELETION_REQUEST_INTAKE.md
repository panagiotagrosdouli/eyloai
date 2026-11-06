# EYLOAI — Owner-only account deletion REQUEST intake (draft)

**Status: not applied to Supabase, disabled by default, NOT a deletion workflow.**

This change provides a controlled way for a signed-in user to **request**
account deletion. It does not delete any Auth user, profile, research data,
Stripe subscription, backups or retained financial records. The database
migration in this draft must not be deployed to the wrong Supabase project.
The actual EYLOAI Supabase ref is `kbzjngpzxpniaumlupaa`; the currently
connected Supabase account exposes only an **unrelated project**.

## Endpoint contract

- `GET /api/account-deletion-request` returns only the verified
  request status for the current authenticated user's Supabase ID.
- `POST /api/account-deletion-request` accepts **exactly**
  `{"confirmation":"REQUEST ACCOUNT DELETION"}`.
  No user ID, email, workspace ID, billing ID or arbitrary fields
  are accepted from the browser.
- The endpoint validates the Bearer token with
  `/auth/v1/user` against the correct Supabase project, before
  accessing the server-only intake table.
- Database `user_id` is always derived from the verified
  Supabase Auth response. `user_id` is the table primary key, so
  repeat and racing requests cannot create duplicate rows.
- All responses use `Cache-Control: private, no-store`.
  The endpoint returns HTTP 202 **only after** it can read back
  a persisted request row. Failures return an error, not false
  confirmation.
- The server feature flag `EYLO_DELETION_REQUESTS_ENABLED=1`
  is **required**. Missing server secrets, a mismatched Supabase
  URL or a disabled flag produce HTTP 503 before any external call.
- The table has RLS and no access granted to `anon` or
  `authenticated`; only a trusted server key may read/insert it.
  Its schema contains no deletion procedure.

## User-facing text

Settings → Privacy shows whether request intake is available. A user
must type the explicit confirmation phrase to record a request.
An accepted status is **pending_review**, not "deleted".
The account remains active, and any Stripe subscription is unchanged.
A subsequent confirmation is not evidence of completion. Do not claim
that all personal data has been erased.

## Activation and acceptance (not performed)

1. Independently verify and connect the actual production-linked
   Supabase project and RLS baseline. Never use the unrelated inactive
   project.
2. Have privacy/legal reviewers approve the applicable deadlines,
   retention and rights process, including Stripe tax/transaction
   records, support, logs, backups, and external processors.
3. Apply this **forward migration only in staging first**. Verify
   table ownership, grants, RLS, read/write with disposable users,
   and environment compatibility. The table's foreign key currently
   deletes the request row when the Auth user is deleted: decide how
   to retain a minimized, lawful audit record **before implementing
   final removal**.
4. Configure the necessary server key, publishable key and
   `EYLO_DELETION_REQUESTS_ENABLED=1` **only after** review.
5. Test malicious body fields, wrong-account identifiers,
   revoked/expired tokens, duplicate and simultaneous requests,
   missing/mismatched Supabase configuration, and a down database.
   Add WAF/rate limits and monitor operational requests, as the
   primary-key constraint is idempotency, not HTTP rate limiting.
6. Implement a **separate** recent-authentication, billing-aware,
   observable final deletion workflow, sign-out/session invalidation,
   cleanup of all user-related tables/storage and documented backup
   retention. Supabase JWTs may remain valid until expiry even after
   Auth user removal.
7. Only after owner/legal/security sign-off may a production
   operator promote the change with rollback and audit evidence.

## Documentation

- `docs/ACCOUNT_DELETION_IMPLEMENTATION_PLAN.md` — full
  account-removal requirements.
- `docs/PRIVACY_DATA_FLOW.md` — data categories and retention.
- Supabase user management:
  https://supabase.com/docs/guides/auth/managing-user-data
- Supabase session revocation:
  https://supabase.com/docs/guides/auth/sessions

**Release decision: NO-GO.** Unit tests and a READY Vercel build
cannot replace live RLS isolation tests, completion of actual deletion,
or privacy/legal review. No real user record was accessed or deleted.
