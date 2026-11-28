do $$
begin
  if not has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'DELETE') then
    raise exception 'Auth cascade role cannot delete user-owned flashcard rows';
  end if;
  if not has_table_privilege('supabase_auth_admin', 'public.eylo_api_token_events', 'DELETE') then
    raise exception 'Auth cascade role cannot delete token audit rows';
  end if;
  if not has_table_privilege('supabase_auth_admin', 'public.eyra_messages', 'DELETE') then
    raise exception 'Auth cascade role cannot delete nested EYRA rows';
  end if;
  if not has_column_privilege('supabase_auth_admin', 'public.eylo_peer_submissions', 'reviewer_id', 'UPDATE') then
    raise exception 'Auth cascade role cannot preserve a submission when its reviewer is deleted';
  end if;
  if exists (
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
    select 1
    from pg_catalog.pg_constraint as foreign_key
    join pg_catalog.unnest(foreign_key.conkey) as key_column(attnum) on true
    join pg_catalog.pg_attribute as column_info
      on column_info.attrelid = foreign_key.conrelid and column_info.attnum = key_column.attnum
    where foreign_key.contype = 'f'
      and foreign_key.confdeltype in ('n', 'd')
      and foreign_key.connamespace in ('public'::regnamespace, 'storage'::regnamespace)
      and (foreign_key.confrelid = 'auth.users'::regclass
        or foreign_key.confrelid in (select table_oid from cascade_tables))
      and not has_column_privilege('supabase_auth_admin', foreign_key.conrelid, column_info.attname, 'UPDATE')
  ) then
    raise exception 'Auth role cannot preserve rows through SET NULL or SET DEFAULT references';
  end if;
  if has_column_privilege('supabase_auth_admin', 'public.eylo_peer_submissions', 'content', 'UPDATE') then
    raise exception 'Auth cascade role received unrelated peer-submission update privileges';
  end if;
  if has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'SELECT')
     or has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'INSERT')
     or has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'UPDATE') then
    raise exception 'Auth cascade role received privileges beyond DELETE';
  end if;
  if has_column_privilege('supabase_auth_admin', 'storage.objects', 'name', 'UPDATE')
     or has_table_privilege('supabase_auth_admin', 'storage.objects', 'SELECT')
     or has_table_privilege('supabase_auth_admin', 'storage.objects', 'INSERT') then
    raise exception 'Auth role received unrelated Storage privileges';
  end if;
end
$$;