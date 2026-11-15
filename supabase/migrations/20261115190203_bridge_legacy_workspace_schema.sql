-- Non-destructive bridge for the observed legacy EYLO tables. Never drop/rebuild
-- a user table, replace ownership policies, or discard unknown JSON fields.
create or replace function public.sync_legacy_workspace_entity()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  excluded text[] := array['id','user_id','data','created_at','updated_at','created_date','updated_date','version'];
  legacy jsonb; previous jsonb; key text; value jsonb;
begin
  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'Workspace data must be a JSON object' using errcode='22023';
  end if;
  if tg_argv[0] = 'legacy_profile' then
    new.user_id := coalesce(new.user_id,new.id);
    new.id := coalesce(new.id,new.user_id);
    if new.id is distinct from new.user_id then raise exception 'Profile owner mismatch' using errcode='42501'; end if;
  end if;
  legacy := to_jsonb(new) - excluded;
  if tg_op = 'UPDATE' then
    previous := to_jsonb(old);
    for key,value in select * from jsonb_each(legacy) loop
      -- Old-client column edits update JSON only when the canonical writer did
      -- not explicitly change that same field. JSON retains arrays/objects.
      if value is distinct from previous->key and new.data->key is not distinct from old.data->key then
        new.data := new.data || jsonb_build_object(key,value);
      end if;
    end loop;
  end if;
  new.data := legacy || new.data;
  new := jsonb_populate_record(new,new.data - excluded);
  new.created_date := case when tg_op='UPDATE' then old.created_date else coalesce(new.created_at,new.created_date,clock_timestamp()) end;
  new.updated_date := case when tg_op='UPDATE' then clock_timestamp() else coalesce(new.updated_at,new.updated_date,clock_timestamp()) end;
  new.created_at := new.created_date;
  new.updated_at := new.updated_date;
  return new;
end;
$$;
revoke all on function public.sync_legacy_workspace_entity() from public,anon;
grant execute on function public.sync_legacy_workspace_entity() to authenticated,service_role;

do $$
declare target text; item record; profile boolean; invalid_data boolean; stamps jsonb; stamp jsonb;
begin
  foreach target in array array['profiles','projects','ideas','meetings','saved_papers','saved_researchers','saved_opportunities','search_history'] loop
    -- Fresh canonical databases need no compatibility trigger or legacy fields.
    if to_regclass('public.'||target) is null or not exists (
      select 1 from information_schema.columns where table_schema='public' and table_name=target and column_name='created_at'
    ) then continue; end if;
    if exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||target) and tgname='zz_legacy_workspace_bridge') then continue; end if;
    profile := target='profiles' and exists(select 1 from information_schema.columns where table_schema='public' and table_name=target and column_name='id');
    execute format('alter table public.%I add column if not exists data jsonb not null default ''{}''::jsonb, add column if not exists created_date timestamptz, add column if not exists updated_date timestamptz',target);
    if profile then execute 'alter table public.profiles add column if not exists user_id uuid'; end if;
    execute format('select exists(select 1 from public.%I where jsonb_typeof(data) is distinct from ''object'')',target) into strict invalid_data;
    if invalid_data then raise exception 'Non-object JSON in % requires review',target; end if;
    -- Suspend only the two observed timestamp-only trigger functions during
    -- metadata backfill. Preserve their exact enable states; RI/audit/ownership
    -- triggers remain active. DDL and backfill are one atomic migration.
    select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'state',t.tgenabled)),'[]'::jsonb) into stamps
      from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
      where t.tgrelid=to_regclass('public.'||target) and not t.tgisinternal and n.nspname='public'
        and p.proname in ('set_updated_at','set_eylo_updated_at') and t.tgenabled <> 'D';
    for stamp in select value from jsonb_array_elements(stamps) loop
      execute format('alter table public.%I disable trigger %I',target,stamp->>'name');
    end loop;
    execute format('update public.%I t set data=(to_jsonb(t)-array[''id'',''user_id'',''data'',''created_at'',''updated_at'',''created_date'',''updated_date'']) || data, created_date=coalesce(created_date,created_at), updated_date=coalesce(updated_date,updated_at)',target);
    if profile then execute 'update public.profiles set user_id=coalesce(user_id,id)'; end if;
    for stamp in select value from jsonb_array_elements(stamps) loop
      execute format('alter table public.%I enable %s trigger %I',target,
        case stamp->>'state' when 'A' then 'always' when 'R' then 'replica' else '' end,stamp->>'name');
    end loop;
    execute format('alter table public.%I alter column created_date set not null, alter column updated_date set not null',target);
    if profile then
      alter table public.profiles alter column user_id set not null;
      create unique index if not exists profiles_bridge_user_id_unique on public.profiles(user_id);
      if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_bridge_owner_matches') then
        alter table public.profiles add constraint profiles_bridge_owner_matches check(id=user_id);
      end if;
    end if;
    execute format('create index if not exists %I on public.%I (user_id,updated_date desc)',target||'_bridge_owner_updated',target);
    execute format('create trigger zz_legacy_workspace_bridge before insert or update on public.%I for each row execute function public.sync_legacy_workspace_entity(%L)',target,case when profile then 'legacy_profile' else 'legacy_entity' end);
  end loop;
end;
$$;
notify pgrst,'reload schema';
