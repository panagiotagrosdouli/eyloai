-- Align the application repositories with the existing production tables.
-- Native columns remain queryable while feature-specific fields are retained
-- in data so no project, search or saved-record detail is silently discarded.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_eylo_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_eylo_updated_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_date = timezone('utc', now());
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects', 'ideas', 'meetings', 'saved_papers',
    'saved_researchers', 'saved_opportunities', 'search_history'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists data jsonb not null default ''{}''::jsonb',
      table_name
    );
    execute format('drop trigger if exists %I on public.%I', table_name || '_eylo_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_eylo_updated_at()',
      table_name || '_eylo_updated_at',
      table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['watchlists', 'monitoring_discoveries', 'notifications']
  loop
    execute format('create table if not exists public.%I (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null default ''{}''::jsonb,
      created_date timestamptz not null default timezone(''utc'', now()),
      updated_date timestamptz not null default timezone(''utc'', now())
    )', table_name);
    execute format(
      'create index if not exists %I on public.%I (user_id, updated_date desc)',
      table_name || '_user_updated_idx',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Users manage own rows" on public.%I', table_name);
    execute format(
      'create policy "Users manage own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format('drop trigger if exists %I on public.%I', table_name || '_eylo_updated_date', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_eylo_updated_date()',
      table_name || '_eylo_updated_date',
      table_name
    );
  end loop;
end $$;

create unique index if not exists monitoring_discoveries_user_external_uidx
  on public.monitoring_discoveries (user_id, (data ->> 'externalId'))
  where nullif(data ->> 'externalId', '') is not null;

grant select, insert, update, delete
  on public.watchlists, public.monitoring_discoveries, public.notifications
  to authenticated;

-- Memberships are provisioned by a trusted backend. Users cannot promote
-- themselves or inspect another institution's membership list.
create table if not exists public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id text not null,
  institution_name text not null,
  role text not null default 'member' check (role in ('member', 'admin', 'owner')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (institution_id, user_id)
);

create index if not exists institution_memberships_user_idx
  on public.institution_memberships (user_id, status);
create index if not exists institution_memberships_institution_idx
  on public.institution_memberships (institution_id, status);

alter table public.institution_memberships enable row level security;
revoke all on public.institution_memberships from anon, authenticated;
grant select, insert, update, delete on public.institution_memberships to service_role;

drop trigger if exists institution_memberships_eylo_updated_at on public.institution_memberships;
create trigger institution_memberships_eylo_updated_at
before update on public.institution_memberships
for each row execute function public.set_eylo_updated_at();

-- The RPC derives the requester exclusively from auth.uid(). It returns an
-- institution-wide view only to a provisioned admin/owner; everyone else gets
-- a useful private workspace view containing only their own records.
create or replace function public.get_workspace_analytics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  selected_membership public.institution_memberships%rowtype;
  member_ids uuid[];
  member_count integer := 1;
  workspace_scope text := 'personal';
  workspace_id text;
  workspace_name text;
  usage_count integer := 0;
  counts jsonb;
begin
  if requester is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
    into selected_membership
    from public.institution_memberships
   where user_id = requester
     and status = 'active'
     and role in ('admin', 'owner')
   order by created_at asc
   limit 1;

  if found then
    workspace_scope := 'institution';
    workspace_id := selected_membership.institution_id;
    workspace_name := selected_membership.institution_name;
    select coalesce(array_agg(user_id), array[requester]::uuid[]), count(*)::integer
      into member_ids, member_count
      from public.institution_memberships
     where institution_id = selected_membership.institution_id
       and status = 'active';
  else
    member_ids := array[requester]::uuid[];
    workspace_id := requester::text;
    select coalesce(nullif(organization, ''), nullif(full_name, ''), 'My workspace')
      into workspace_name
      from public.profiles
     where id = requester
     limit 1;
    workspace_name := coalesce(workspace_name, 'My workspace');
  end if;

  select jsonb_build_object(
    'projects', (select count(*) from public.projects where user_id = any(member_ids)),
    'saved_papers', (select count(*) from public.saved_papers where user_id = any(member_ids)),
    'saved_researchers', (select count(*) from public.saved_researchers where user_id = any(member_ids)),
    'saved_opportunities', (select count(*) from public.saved_opportunities where user_id = any(member_ids)),
    'meetings', (select count(*) from public.meetings where user_id = any(member_ids)),
    'watchlists', (select count(*) from public.watchlists where user_id = any(member_ids))
  ) into counts;

  if to_regclass('public.eyra_usage_actions') is not null then
    execute 'select count(*)::integer from public.eyra_usage_actions where user_id = any($1) and usage_month = $2'
      into usage_count
      using member_ids, to_char(timezone('utc', now()), 'YYYY-MM');
  end if;

  return jsonb_build_object(
    'scope', workspace_scope,
    'institution_id', workspace_id,
    'institution_name', workspace_name,
    'members', member_count,
    'ai_actions_this_month', usage_count,
    'counts', counts,
    'generated_at', timezone('utc', now())
  );
end;
$$;

revoke all on function public.get_workspace_analytics() from public, anon;
grant execute on function public.get_workspace_analytics() to authenticated;
