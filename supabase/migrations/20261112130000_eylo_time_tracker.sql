create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  life_item_id uuid references public.life_items(id) on delete set null,
  description text not null check (char_length(description) between 1 and 500),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create index if not exists time_entries_owner_start_idx on public.time_entries(user_id, started_at desc);
create index if not exists time_entries_project_idx on public.time_entries(user_id, project_id, started_at desc);
create unique index if not exists time_entries_one_running_per_user on public.time_entries(user_id) where ended_at is null;
alter table public.time_entries enable row level security;
drop policy if exists "Users manage own time entries" on public.time_entries;
create policy "Users manage own time entries" on public.time_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
    and (life_item_id is null or exists (
      select 1 from public.life_items i where i.id = life_item_id and i.user_id = (select auth.uid())
    ))
  );
create or replace function public.set_time_entry_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists time_entries_set_updated_at on public.time_entries;
create trigger time_entries_set_updated_at before update on public.time_entries
for each row execute function public.set_time_entry_updated_at();
grant select, insert, update, delete on public.time_entries to authenticated;
