# Two-account EYLO RLS acceptance — read-only staging gate

This is a **read-only, opt-in** verification harness, not proof that production ownership or authorization has been validated.

## Use only with the intended staging environment

The script `scripts/verify-rls-two-accounts.mjs` intentionally refuses to run unless:
- `EYLO_RLS_SUPABASE_URL` exactly matches the explicitly pinned EYLO project URL in the script;
- `EYLO_RLS_PUBLISHABLE_KEY` is configured through protected environment variables;
- `EYLO_RLS_TEST_A_EMAIL`, `EYLO_RLS_TEST_A_PASSWORD`, `EYLO_RLS_TEST_B_EMAIL`, and `EYLO_RLS_TEST_B_PASSWORD` belong to **two different disposable, authorized test accounts**.

**Never commit credentials, paste them in a chat, or run the harness against unrelated Supabase projects.** Confirm the intended Supabase project and deployment mapping with the owner before enabling this gate.

Run only in an approved staging or production-matching test environment:

```bash
node scripts/verify-rls-two-accounts.mjs
```

The harness signs in both accounts and tests owner-scoped reads versus cross-user reads across profiles, projects, saved papers, researchers, opportunities, meetings and watchlists. Missing owner fixtures are reported as inconclusive.

## What remains unverified

A successful read-only test **does not** establish authorization for create/update/delete, project membership, shared collaboration, Storage buckets, LiveKit rooms, billing, or server-side service-role endpoints. Those require separate test fixtures and policy review. Account-deletion semantics and two-browser session switching also require explicit acceptance.

The connected Supabase account used during development did not contain the project pinned in this script. Therefore, no live test against that project has been claimed.
