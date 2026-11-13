# Two-account EYLO RLS acceptance — read-only staging gate

This is a **read-only, opt-in** verification harness, not proof that production ownership or authorization has been validated.

## Use only with the intended staging environment

The script `scripts/verify-rls-two-accounts.mjs` intentionally refuses to run unless:
- `EYLO_ENVIRONMENT=staging`, `EYLO_STAGING_SUPABASE_REF` and `EYLO_STAGING_CONFIRMED_REF` identify the same separately authorized staging project;
- `EYLO_RLS_SUPABASE_URL` exactly matches that official staging URL; the live EYLO and unrelated refs are rejected;
- `EYLO_RLS_PUBLISHABLE_KEY` is configured through protected environment variables;
- `EYLO_RLS_TEST_A_EMAIL`, `EYLO_RLS_TEST_A_PASSWORD`, `EYLO_RLS_TEST_B_EMAIL`, and `EYLO_RLS_TEST_B_PASSWORD` belong to **two different disposable, authorized test accounts**.

**Never commit credentials, paste them in a chat, or run the harness against unrelated Supabase projects.** Confirm the intended Supabase project and deployment mapping with the owner before enabling this gate.

Run only in an approved staging or production-matching test environment:

```bash
node scripts/verify-rls-two-accounts.mjs
```

The harness signs in two distinct accounts and tests owner-scoped reads versus cross-user reads across profiles and all30 canonical export collections. Missing or one-sided owner fixtures are inconclusive and exit2; they never produce a successful isolation result. Authentication uses public credentials and the disposable users' bearers only. Production targets, secret/service-role public keys, mismatched refs and duplicate account emails fail before network requests.

## What remains unverified

A successful read-only test **does not** establish authorization for create/update/delete, project membership, shared collaboration, Storage buckets, LiveKit rooms, billing, or server-side service-role endpoints. Those require separate test fixtures and policy review. Account-deletion semantics and two-browser session switching also require explicit acceptance.

The connected Supabase account used during development does not expose a separately confirmed EYLO staging project. Therefore, no live test against that project has been claimed.
