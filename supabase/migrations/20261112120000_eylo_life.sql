create table if not exists public.life_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  calendar_event_id uuid,
  parent_id uuid references public.life_items(id) on delete set null,
  item_type text not null check (item_type in ('goal','task','habit','routine','milestone')),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  due_at timestamptz,
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 1 and 10080),
  timezone text not null default 'UTC',
  cadence text not null default 'none' check (cadence in ('none','daily','weekly','monthly')),
  status text not null default 'active' check (status in ('active','completed','archived')),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists life_items_owner_type_due_idx on public.life_items(user_id, item_type, due_at);
create index if not exists life_items_parent_idx on public.life_items(user_id, parent_id);
create or replace function public.is_user_life_goal(p_parent_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) = p_user_id and exists (
    select 1 from public.life_items i
    where i.id = p_parent_id and i.user_id = p_user_id and i.item_type = 'goal'
  );
$$;
revoke all on function public.is_user_life_goal(uuid, uuid) from public, anon;
grant execute on function public.is_user_life_goal(uuid, uuid) to authenticated;
alter table public.life_items enable row level security;
drop policy if exists "Users manage own life items" on public.life_items;
create policy "Users manage own life items" on public.life_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
    and (parent_id is null or (item_type <> 'goal' and public.is_user_life_goal(parent_id, user_id)))
  );

create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  life_item_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (life_item_id, user_id) references public.life_items(id, user_id) on delete cascade,
  unique (life_item_id, user_id, completed_on)
);
create index if not exists habit_checkins_owner_day_idx on public.habit_checkins(user_id, completed_on desc);
alter table public.habit_checkins enable row level security;
drop policy if exists "Users manage own habit checkins" on public.habit_checkins;
create policy "Users manage own habit checkins" on public.habit_checkins
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.life_items i
      where i.id = life_item_id and i.user_id = (select auth.uid()) and i.item_type = 'habit')
  );

create or replace function public.set_life_item_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists life_items_set_updated_at on public.life_items;
create trigger life_items_set_updated_at before update on public.life_items
for each row execute function public.set_life_item_updated_at();

create unique index if not exists life_items_calendar_event_unique on public.life_items(calendar_event_id)
  where calendar_event_id is not null;
create or replace function public.sync_life_item_calendar_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.calendar_events where life_item_id = old.id and user_id = old.user_id;
    return old;
  end if;

  if new.item_type in ('task','milestone') and new.due_at is not null then
    update public.calendar_events set
        title = new.title,
        description = new.description,
        subject = new.item_type,
        event_type = 'deadline',
        starts_at = new.due_at,
        timezone = new.timezone,
        recurrence = new.cadence,
        reminder_minutes = new.reminder_minutes,
        status = case when new.status = 'completed' then 'completed' else 'scheduled' end,
        project_id = new.project_id
      where life_item_id = new.id and user_id = new.user_id
      returning id into new.calendar_event_id;
    if not found then
      insert into public.calendar_events(
        user_id, project_id, life_item_id, title, description, subject, event_type, starts_at,
        timezone, recurrence, reminder_minutes, status
      ) values (
        new.user_id, new.project_id, new.id, new.title, new.description, new.item_type, 'deadline', new.due_at,
        new.timezone, new.cadence, new.reminder_minutes,
        case when new.status = 'completed' then 'completed' else 'scheduled' end
      ) returning id into new.calendar_event_id;
    end if;
  elsif new.calendar_event_id is not null then
    delete from public.calendar_events where life_item_id = new.id and user_id = new.user_id;
    new.calendar_event_id := null;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_life_item_calendar_event() from public, anon, authenticated;
drop trigger if exists life_items_calendar_sync on public.life_items;
create trigger life_items_calendar_sync before insert or update on public.life_items
for each row execute function public.sync_life_item_calendar_event();
drop trigger if exists life_items_calendar_cleanup on public.life_items;
create trigger life_items_calendar_cleanup after delete on public.life_items
for each row execute function public.sync_life_item_calendar_event();

grant select, insert, update, delete on public.life_items, public.habit_checkins to authenticated;
