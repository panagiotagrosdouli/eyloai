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

## Read-only owner data preflight (follow-up draft)

A second server-only switch, `EYLO_DELETION_PREFLIGHT_ENABLED=1`, can
expose `GET /api/account-deletion-preflight` **only when** request intake
is also independently enabled and the current user already has an open
request (`pending_review`, `in_review` or `blocked_billing`).
The requester identity is reverified using Supabase Auth and supplied
`user_id` query strings or request bodies are entirely ignored.

The endpoint sends **HEAD requests**, using `Prefer: count=exact`,
`select=user_id` and a filter on the verified Auth user ID, to inspect
only aggregate record counts from these 14 classes:

- profiles, projects, ideas, meetings
- saved_papers, saved_researchers, saved_opportunities, search_history
- watchlists, monitoring_discoveries, notifications
- eyra_usage_actions, institution_memberships, billing_entitlements

Each HEAD must succeed and provide a numeric `Content-Range` total.
Unknown counts, missing tables, changed schemas or permission errors
return HTTP 502 **without publishing a partial/false-zero inventory**.
The browser displays read-only counts only after the user explicitly
clicks the inventory button; the endpoint never returns the user ID,
raw research, paper titles, emails or customer identifiers.

This list is derived from repository migrations only. **It is NOT a
complete, validated live schema inventory** and cannot inspect
Supabase Storage, Stripe invoices and subscription state, backups,
AI provider or application logs, institutional ownership transfer,
session revocation or the actual deployed migration history. Those
always remain explicit independent review blockers. Even if every
reported count is zero, the response always sets
`account_deleted: false` and `deletion_authorized: false`.

Data counting alone never authorizes service-role DELETE access,
`auth.admin.deleteUser()`, Stripe cancellation or a user-facing
"account removed" message. This preflight makes **no modifications**,
uses bounded batches of four HEAD calls and does not enable final
deletion. The feature remains off until the correct Supabase project,
schema and access boundaries have been verified with disposable
accounts and the responsible operators approve read-only use.

Relevant documentation:
- PostgREST exact row counts via HEAD:
  https://postgrest.org/en/stable/references/api/pagination_count.html
- Supabase user deletion and storage object caveats:
  https://supabase.com/docs/guides/auth/managing-user-data
- Supabase JWT session lifecycle:
  https://supabase.com/docs/guides/auth/sessions

**All live acceptance gates remain NO-GO.**

## Owner-scoped billing risk checkpoint (read-only)

The preflight now includes **one additional, bounded, owner-filtered GET**
against `billing_entitlements` for `plan`, `subscription_status`,
`stripe_customer_id`, and `stripe_subscription_id`.
These four fields stay on the server: only booleans indicating whether
a local paid-plan, customer link or subscription link exists are returned
to the user. Raw Stripe IDs and payment data are never returned in the
response, and the endpoint performs **no Stripe API call**.

No local billing row means **unknown**, NOT "safe to delete".
`requires_independent_stripe_review` is **always true**, irrespective
of local records. A failed request, malformed row, duplicate rows or
unexpected entitlement status causes the entire preflight to fail
without publishing partial/falsely reassuring evidence.

The server's ability to check a local link does **not** verify whether
a remote Stripe subscription is still active or whether cancellation,
tax, invoices, disputes and retention require further action.
A future final deletion workflow must obtain live, independently
authorized Stripe and Supabase evidence, plus an actual **fresh-user
authentication** proof tied to that session. In particular,
a recent account-wide `last_sign_in_at` timestamp by itself is
NOT proof that the specific Bearer session was recently reauthenticated.

The request intake and inventory remain disabled by default.
A verified Bearer token authorizes **only an intake request or
read-only inventory**, NEVER irreversible account deletion.

## Closed requests and fresh authentication — independent review required

A subsequent POST for a request already marked `completed` or
`declined` now returns HTTP **409 `DELETION_REQUEST_CLOSED`**, rather
than the misleading HTTP 202 acknowledgement previously returned.
An existing open request (`pending_review`, `in_review`,
`blocked_billing`) remains idempotent and does not create a duplicate.
The user can read their previous status with GET and is advised to
contact support about a new request. A reviewed **reopening** workflow
is not yet built; this is a privacy/operational acceptance blocker.

Current Bearer token checks require a valid Supabase Auth `/auth/v1/user`
response. The tests cover expired/revoked credentials that Auth actually
rejects, but a valid unexpired bearer token can still be used for
**request intake or read-only inventory**. Neither endpoint executes
account deletion. Before implementing actual deletion, the operator must
build a separate session-bound step-up verification mechanism and verify
its freshness, replay resistance, revocation behavior, billing state
and consent with disposable users. Merely checking the account's global
`last_sign_in_at` or the JWT's issued-at timestamp is insufficient
evidence of recent user reauthentication.
