# Institution Analytics release safety — isolated hotfix

This focused change addresses a misleading public availability flag in
`/api/capabilities`. The former main deployment returned
`institution_analytics: true` unconditionally, even though the actual
production analytics SQL migration, grants and two-account isolation had not
been checked.

## Safe behavior

- Default: `institution_analytics: false`. The dashboard shows an
  unavailable/setup message rather than displaying unverified numbers.
- `GET /api/admin-analytics` rejects missing authorization with 401
  and returns an uncached HTTP 503 with
  `code: ANALYTICS_NOT_ENABLED` for an otherwise well-formed request
  while the capability is disabled. **No upstream database RPC call occurs.**
- All backend responses use `Cache-Control: private, no-store`.
  The optional enabled path validates the returned RPC payload and rejects
  invalid successful responses.
- An operator may set the *server-only* `EYLO_ANALYTICS_ENABLED=1`
  **only after** verified project ID, checked actual deployed RPC schema,
  approved SECURITY DEFINER grants, and successful disposable two-account
  RLS and analytics tests. This flag is not evidence of such review.
- Changing the flag does **not** apply SQL migrations or repair an
  already-applied analytics function. See the release-candidate PR #203
  and dedicated Analytics repair PR #201 for the separately blocked
  migration and staging test plan.

This is an isolated security/truthfulness hotfix and does not enable
billing, fix RLS or account deletion, validate the EYRA scientific reviewer,
or authorize an all-product launch. No production data access was used to
author or test this patch. This branch remains draft pending review;
no automatic production promotion is allowed.
