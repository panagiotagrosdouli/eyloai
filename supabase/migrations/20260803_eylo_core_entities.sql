create extension if not exists pgcrypto;

create or replace function public.set_updated_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_date = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now())
);

do $$
declare table_name text;
begin
  foreach table_name in array array['projects','ideas','meetings','saved_papers','saved_researchers','saved_opportunities','search_history']
  loop
    execute format('create table if not exists public.%I (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null default ''{}''::jsonb,
      created_date timestamptz not null default timezone(''utc'', now()),
      updated_date timestamptz not null default timezone(''utc'', now())
    )', table_name);
    execute format('create index if not exists %I on public.%I (user_id, updated_date desc)', table_name || '_user_updated_idx', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Users manage own rows" on public.%I', table_name);
    execute format('create policy "Users manage own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_date', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_date()', table_name || '_set_updated_date', table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop trigger if exists profiles_set_updated_date on public.profiles;
create trigger profiles_set_updated_date before update on public.profiles
for each row execute function public.set_updated_date();

create index if not exists meetings_project_idx on public.meetings ((data ->> 'project_id'));
create index if not exists projects_status_idx on public.projects ((data ->> 'status'));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
