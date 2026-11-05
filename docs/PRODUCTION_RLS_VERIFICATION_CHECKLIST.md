# EYLO production RLS verification checklist

Status: **Unverified on the deployed EYLO database**. This is an operational checklist, not a security certification.

## Environment matching
- Confirm the Supabase project URL configured for the deployed EYLO environment.
- Ensure the connected audit project ID matches the deployment's Supabase project reference **before any database query or migration**.
- On 2026-10-20, the available connector project did **not** match the project reference in the checked production environment file. No queries or writes were made to either database.

## Repository evidence
- `supabase/migrations/20260817090500_security_hardening.sql` defines owner-scoped policies on profiles and seven user-owned workspace tables, using `(select auth.uid()) = user_id`.
- The same migration has service-role-only policies for billing, webhook, usage and institution membership tables.
- Migration source is **not proof** that migrations were applied to the live database.

## Required live verification (read-only first)
1. Confirm migration status, RLS flags and effective policies for every exposed table in the actual deployment.
2. Review SECURITY DEFINER functions, EXECUTE grants and any views that could bypass RLS.
3. With two isolated test accounts, verify that A cannot select, insert for, update or delete B's projects, research records, ideas, meetings or history.
4. Verify anonymous clients cannot read private workspace or billing rows.
5. Check API endpoints independently for user ownership, not solely frontend route protection.
6. Run Supabase database/security advisors and record findings.
7. Audit retention and deletion for profile, workspace, auth, usage, billing, monitoring, logs and external processors before advertising account deletion.

## Release gate
Do not label production access control or account deletion as verified until live negative tests pass and are recorded with date, environment and test evidence. Never include user data, access tokens or secrets in audit logs or public issues.

## Two-user PostgREST acceptance runner (added 2026-11-05)

This runner does **not** use the connected Supabase project's credentials, a service-role key, live customer records, or production writes by default.

Run `npm run audit:rls` for an **offline preflight only**. It requires no network access or credentials.

A live **read-only** ownership sanity check requires the operator, in a secure local terminal or protected CI environment, to configure:

- `EYLO_RLS_LIVE=1`
- `EYLO_RLS_SUPABASE_URL`: the intended HTTPS Supabase project origin.
- `EYLO_RLS_CONFIRMED_PRODUCTION_URL`: a *separately confirmed* URL from the actual EYLO production configuration, not a guess from a similarly named project.
- `EYLO_RLS_EXPECTED_PROJECT_REF`: the matching project reference, verified in the production Supabase dashboard.
- `EYLO_RLS_PUBLIC_KEY`: that project's public publishable (or legacy anon) key — **not** a service-role key.
- `EYLO_RLS_TOKEN_A` and `EYLO_RLS_TOKEN_B`: access tokens belonging to **two distinct, disposable test accounts** in that project, kept in the secure environment, never pasted in chat or committed.
- Optional `EYLO_RLS_TABLES`, default `projects,saved_papers`; supported tables are the ten user-owned workspace/monitoring tables in the source.

With these verified values, run `npm run audit:rls -- --live`.
This performs only authenticated GET requests on selected tables, checking that any returned rows belong to the requesting account. **It is NOT proof of RLS isolation**, especially when a table is empty.

For a deliberate two-user *negative CRUD* acceptance test, in a verified isolated staging environment or using genuinely disposable accounts and data, set `EYLO_RLS_TEST_WRITES=DISPOSABLE_ACCOUNTS_ONLY` and run `npm run audit:rls -- --live --write-test-fixtures`. This creates identifiable disposable JSONB rows as accounts A and B, tests that the other account and anonymous callers cannot read them, attempts forbidden cross-account PATCH/DELETE, re-reads them as the owner, and deletes the fixtures in `finally`. An unexpected database outage may leave disposable test rows behind: inspect and clean up only the identified test account data.

**Important:** For full coverage, explicitly select all ten owned tables, confirm the schema supports disposable JSONB fixture inserts, and separately inspect `profiles`, privileged billing tables, RPC EXECUTE grants, SECURITY DEFINER functions, exposed views, storage policies, auth recovery and application-level flows. The script does not test those. Never interpret a green Node test or successful preflight as a completed production RLS audit.

The connected Supabase project available to this conversation is not the production EYLO project. **No live execution has been performed.** Release Gate C remains unchecked until the correct project is connected and the actual live evidence is recorded.
