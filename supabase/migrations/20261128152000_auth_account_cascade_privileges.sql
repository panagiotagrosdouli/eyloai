-- Supabase Auth deletes auth.users through its supabase_auth_admin connection.
-- PostgreSQL executes cascading DELETE actions using that role, so explicitly
-- grant only DELETE on public/storage rows reachable through ON DELETE CASCADE from an
-- Auth user. This enables Auth's hard-delete endpoint without granting reads,
-- writes, schema ownership, or access to tables outside the user-data cascade.
do $$
declare
  target_table regclass;
  update_target record;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    raise exception 'Supabase Auth database role is unavailable';
  end if;

  for target_table in
    with recursive cascade_tables(table_oid) as (
      select constraint_row.conrelid
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.contype = 'f'
        and constraint_row.confrelid = 'auth.users'::regclass
        and constraint_row.confdeltype = 'c'
        and constraint_row.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
      union
      select child_constraint.conrelid
      from pg_catalog.pg_constraint as child_constraint
      join cascade_tables as parent_table on child_constraint.confrelid = parent_table.table_oid
      where child_constraint.contype = 'f'
        and child_constraint.confdeltype = 'c'
        and child_constraint.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
    )
    select distinct table_oid::regclass
    from cascade_tables
    order by table_oid::regclass
  loop
    execute format('grant delete on table %s to supabase_auth_admin', target_table);
  end loop;

  -- Preserve unrelated rows when a user is referenced through SET NULL or
  -- SET DEFAULT. Grant
  -- column-level UPDATE only on those foreign-key columns, including set-null
  -- links from one cascaded user-owned table to another.
  for update_target in
    with recursive cascade_tables(table_oid) as (
      select constraint_row.conrelid
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.contype = 'f'
        and constraint_row.confrelid = 'auth.users'::regclass
        and constraint_row.confdeltype = 'c'
        and constraint_row.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
      union
      select child_constraint.conrelid
      from pg_catalog.pg_constraint as child_constraint
      join cascade_tables as parent_table on child_constraint.confrelid = parent_table.table_oid
      where child_constraint.contype = 'f'
        and child_constraint.confdeltype = 'c'
        and child_constraint.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
    )
    select foreign_key.conrelid::regclass as table_name,
      string_agg(format('%I', column_info.attname), ', ' order by key_column.ordinality) as columns
    from pg_catalog.pg_constraint as foreign_key
    join pg_catalog.unnest(foreign_key.conkey) with ordinality as key_column(attnum, ordinality) on true
    join pg_catalog.pg_attribute as column_info
      on column_info.attrelid = foreign_key.conrelid and column_info.attnum = key_column.attnum
    where foreign_key.contype = 'f'
      and foreign_key.confdeltype in ('n', 'd')
      and foreign_key.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
      and (foreign_key.confrelid = 'auth.users'::regclass
        or foreign_key.confrelid in (select table_oid from cascade_tables))
    group by foreign_key.conrelid, foreign_key.oid
  loop
    execute format('grant update (%s) on table %s to supabase_auth_admin', update_target.columns, update_target.table_name);
  end loop;
end
$$;
