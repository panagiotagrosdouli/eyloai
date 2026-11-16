# Stripe webhook test-mode safety — 2026-11-16

## Scope

Follow-up to the merged checkout safety PR #488. This branch applies the **same deny-by-default staging gate** to the Stripe webhook endpoint, which otherwise could accept signed live events and update server-owned billing entitlements regardless of whether interactive checkout was disabled.

- A non-POST request remains 405.
- A POST request is rejected with HTTP 503 before reading a webhook body if `EYLO_BILLING_TEST_ENABLED`, the approved staging Supabase identity, or TEST credentials are missing.
- After a correctly signed payload has been parsed, the event **must explicitly carry `livemode: false`**. Live-mode events, malformed events and events without this field fail with 400 before any Supabase RPC.
- Existing signature time-window, bounded raw-body reader, idempotent database RPC and sanitized failures are preserved.

## Verification boundaries

Automated Node tests use only fabricated identities, local signed fixtures and stubbed fetch. They check early rejection, live-mode denial, signature denial and the server-only test-mode entitlement write path. These tests do **not** establish Stripe provider compatibility or DB idempotency in a real tenant.

Before enabling the staging flag:
1. Verify the GitHub candidate commit and its all-green CI, then inspect the PR diff and preview SHA.
2. Independently identify and authorize a **separate** Supabase staging project; do not use `kbzjngpzxpniaumlupaa` (EYLO production) or `umzrggayitzfgrrofjnw` (historically unrelated).
3. Configure `EYLO_ENVIRONMENT=staging`, the matching staging refs, `EYLO_BILLING_TEST_ENABLED=1`, and verified Stripe `sk_test_` / `whsec_` / `price_` values as protected server environment variables. Do not expose or print secrets in source, logs or chat.
4. On the staging endpoint only, test signed Stripe test-mode Checkout, subscription renewal, failure, cancellation, duplicate/out-of-order events, retries, and the authoritative `apply_billing_entitlement` RPC against two disposable user accounts.
5. Verify entitlements never change for another user and that test data can be safely removed. Record sanitized evidence, reviewer, exact SHA and deployment IDs.
6. Keep production live charges and production billing **disabled** absent a new reviewed release program and explicit owner authorization. This gate is intentionally not a live-billing switch.

## Result

The candidate can be marked **SOURCE IMPLEMENTED** after tests and code review, but **NOT STAGING ACCEPTED**, **NOT PRODUCTION READY**, and **NO-GO** for launching paid billing without the above tests and authorizations.
