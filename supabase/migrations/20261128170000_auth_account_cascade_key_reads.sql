-- PostgreSQL's internal FK cascade checks read the referencing key columns
-- while deleting auth.users. DELETE alone is not enough for the role used by
-- Supabase Auth. Grant SELECT only on foreign-key columns in the same user
-- cascade graph; never grant table-wide reads of researcher content.
do $$
declare
  select_target record;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    raise exception 'Supabase Auth database role is unavailable';
  end if;

  -- FK actions resolve relation names in application schemas. USAGE reveals
  -- no table contents and CREATE remains explicitly ungranted.
  execute 'grant usage on schema public, storage to supabase_auth_admin';

  for select_target in
    with recursive cascade_tables(table_oid) as (
      select constraint_row.conrelid
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.contype = 'f'
        and constraint_row.confrelid = 'auth.users'::regclass
        and constraint_row.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
      union
      select child_constraint.conrelid
      from pg_catalog.pg_constraint as child_constraint
      join cascade_tables as parent_table on child_constraint.confrelid = parent_table.table_oid
      where child_constraint.contype = 'f'
        and child_constraint.confdeltype = 'c'
        and child_constraint.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
    )
    select distinct foreign_key.conrelid::regclass as table_name,
      column_info.attname as column_name
    from pg_catalog.pg_constraint as foreign_key
    join pg_catalog.unnest(foreign_key.conkey) with ordinality as key_column(attnum, ordinality) on true
    join pg_catalog.pg_attribute as column_info
      on column_info.attrelid = foreign_key.conrelid and column_info.attnum = key_column.attnum
    where foreign_key.contype = 'f'
      and foreign_key.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
      and (foreign_key.confrelid = 'auth.users'::regclass
        or foreign_key.confrelid in (select table_oid from cascade_tables))
  loop
    execute format('grant select (%I) on table %s to supabase_auth_admin', select_target.column_name, select_target.table_name);
  end loop;
end
$$;
