# EYLO analytics — production schema compatibility repair

**Status: source correction ready; NOT applied to the production database.**
**Do not mark Institution / Workspace Analytics verified from these tests alone.**

## The confirmed source-code mismatch

The base migration `20260803_eylo_core_entities.sql` defines
`public.profiles(user_id uuid, data jsonb, created_date, ...)`. The
analytics definitions in `20260817090000_operational_services.sql`
and `20260817090600_analytics_rpc_boundary.sql` originally queried
`public.profiles.id`, `organization` and `full_name` as columns.
The smoke migration `20260817090700_analytics_smoke_verification.sql`
also queried non-existent `id` and `created_at` columns.

The revised source now reads `profiles.user_id` and
`profiles.data ->> 'organization'` / `'full_name'`, with a neutral
name fallback. These regression tests verify **source consistency**,
not a live database installation.

## Existing database installations

Editing historic migration files does **not** modify an already-migrated
Supabase project. In the actual production Supabase dashboard (after
independently verifying its project ref against the Vercel deployment):

1. **Read only:** inspect the existing `public.profiles` columns,
   `private.get_workspace_analytics_internal()` definition, public
   gateway privileges and actual migration history. Do not assume the
   production schema is identical to local source.
2. On a checked-out repository with the current Supabase CLI installed,
   run `supabase --version`, then `supabase migration new fix_analytics_profile_schema`.
   **Copy the exact newly created file path from the CLI output.**
3. Run `node scripts/prepare-analytics-repair.mjs --check` to validate the
   reviewed source. Then run `node scripts/prepare-analytics-repair.mjs --write
   supabase/migrations/<CLI-created-filename>.sql` (substitute the **actual**
   new path). This fills only that empty, correctly named migration with the
   reviewed private aggregation and public invoker gateway SQL and explicit
   function permissions. The script rejects existing non-empty files.
   Do **not** re-run/edit a historical applied migration as an upgrade.
   Review the full generated diff and actual schema compatibility before use.
4. Apply and exercise the migration **first in staging** with an
   authenticated disposable account and an institution admin. Verify
   that an ordinary user sees only their own counts, an institution
   admin sees only authorized members, and anonymous callers cannot
   execute the RPC.
5. Review Supabase security advisors, log errors and confirm a
   separate-account negative test before any production application.
   Apply through the verified deployment process, not via this chat's
   unrelated Supabase connection.

Suggested read-only inspection (in the **correct** project's SQL
editor, without including credentials or customer data in reports):

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

select pg_get_functiondef('private.get_workspace_analytics_internal()'::regprocedure);
```

The second query only works if the private function exists; its
absence means the earlier deployment state must be investigated.
Do not log or publish real account names, organization names, or
analytics counts from those checks.

## Release gate

A green `npm test` proves that checked-in SQL definitions align,
not that the production Supabase database was migrated or that the
`/api/admin-analytics` endpoint works for authenticated users.
Keep launch Gate C/E and the analytics acceptance check **open**
until real read-only schema inspection and two-user acceptance pass.
