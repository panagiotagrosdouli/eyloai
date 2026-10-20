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
