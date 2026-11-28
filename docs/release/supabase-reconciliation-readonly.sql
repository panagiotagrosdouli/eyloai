-- Read-only catalog snapshot queries for the 2026-11-28 EYLO reconciliation.
-- Run each SELECT on the explicitly authorized target. No DDL/DML is present.

-- 1. Applied migration order/name inventory.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- 2. Public and Storage table RLS state and public policy coverage.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       count(p.policyname) as policy_count,
       coalesce(string_agg(p.cmd, ',' order by p.cmd), '') as policy_commands
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where c.relkind in ('r', 'p') and n.nspname in ('public', 'storage')
group by n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
order by n.nspname, c.relname;

-- 3. Exact policy expressions for public tables and Storage objects.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 4. RPC execute grants and SECURITY DEFINER status for exposed public routines.
select n.nspname as schema_name, p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       coalesce(array_agg(distinct r.grantee) filter (where r.grantee is not null), '{}') as execute_grantees
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join information_schema.routine_privileges r
  on r.routine_schema = n.nspname and r.routine_name = p.proname
where n.nspname = 'public'
group by n.nspname, p.proname, p.oid, p.prosecdef
order by p.proname, arguments;

-- 5. Public foreign-key definitions, supporting unique/index definitions, and validity.
-- Review advisor output as well: a composite index is not necessarily useful for
-- a predicate unless the indexed leading columns match the workload.
select conrelid::regclass::text as table_name, conname,
       pg_get_constraintdef(oid) as foreign_key_definition
from pg_constraint
where contype = 'f' and connamespace = 'public'::regnamespace
order by conrelid::regclass::text, conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 6. Public and Storage view definitions (if any).
select schemaname, viewname, definition
from pg_views
where schemaname in ('public', 'storage')
order by schemaname, viewname;
