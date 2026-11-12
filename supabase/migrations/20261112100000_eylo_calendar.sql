create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  subject text not null default '' check (char_length(subject) <= 120),
  event_type text not null default 'event' check (event_type in ('event','deadline','exam','study')),
  starts_at timestamptz not null,
  timezone text not null default 'UTC',
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
  status text not null default 'scheduled' check (status in ('scheduled','completed')),
  reminder_minutes integer check (reminder_minutes is null or reminder_minutes between 1 and 10080),
  last_reminder_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_owner_start_idx on public.calendar_events(user_id, starts_at);
create index if not exists calendar_events_reminders_idx on public.calendar_events(reminder_minutes, starts_at)
  where reminder_minutes is not null;
create or replace function public.validate_calendar_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform 1 from pg_catalog.pg_timezone_names where name = new.timezone;
  if not found then
    raise exception 'Invalid time zone.' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists calendar_events_validate on public.calendar_events;
create trigger calendar_events_validate before insert or update on public.calendar_events
for each row execute function public.validate_calendar_event();
create or replace function public.set_calendar_event_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at before update on public.calendar_events
for each row execute function public.set_calendar_event_updated_at();
alter table public.calendar_events enable row level security;
drop policy if exists "Users manage own calendar events" on public.calendar_events;
create policy "Users manage own calendar events" on public.calendar_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
  );

create or replace function public.dispatch_calendar_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  event_row public.calendar_events%rowtype;
  occurrence timestamptz;
  local_now timestamp;
  local_start timestamp;
  n integer;
  sent_count integer := 0;
  now_utc timestamptz := now();
begin
  for event_row in
    select * from public.calendar_events
    where reminder_minutes is not null
      and status <> 'completed'
      and (recurrence <> 'none' or (
        starts_at > now_utc
        and starts_at - make_interval(mins => reminder_minutes) <= now_utc
        and starts_at - make_interval(mins => reminder_minutes) > now_utc - interval '90 minutes'
      ))
    order by starts_at
    for update skip locked
  loop
    occurrence := event_row.starts_at;
    local_now := now_utc at time zone event_row.timezone;
    local_start := event_row.starts_at at time zone event_row.timezone;
    if event_row.recurrence = 'daily' then
      n := greatest(0, ceil(extract(epoch from (local_now - local_start)) / 86400)::integer);
      occurrence := (local_start + n * interval '1 day') at time zone event_row.timezone;
      if occurrence <= now_utc then occurrence := (local_start + (n + 1) * interval '1 day') at time zone event_row.timezone; end if;
    elsif event_row.recurrence = 'weekly' then
      n := greatest(0, ceil(extract(epoch from (local_now - local_start)) / 604800)::integer);
      occurrence := (local_start + n * interval '1 week') at time zone event_row.timezone;
      if occurrence <= now_utc then occurrence := (local_start + (n + 1) * interval '1 week') at time zone event_row.timezone; end if;
    elsif event_row.recurrence = 'monthly' then
      n := greatest(0, (extract(year from age(local_now, local_start)) * 12
        + extract(month from age(local_now, local_start)))::integer);
      occurrence := (local_start + n * interval '1 month') at time zone event_row.timezone;
      if occurrence <= now_utc then occurrence := (local_start + (n + 1) * interval '1 month') at time zone event_row.timezone; end if;
    end if;

    if occurrence > now_utc
      and occurrence - make_interval(mins => event_row.reminder_minutes) <= now_utc
      and occurrence - make_interval(mins => event_row.reminder_minutes) > now_utc - interval '90 minutes'
      and event_row.last_reminder_for is distinct from occurrence then
      insert into public.notifications(user_id, data)
      values (event_row.user_id, jsonb_build_object(
        'title', event_row.title,
        'description', 'Reminder: this calendar item starts at ' || to_char(occurrence at time zone event_row.timezone, 'YYYY-MM-DD HH24:MI') || ' (' || event_row.timezone || ').',
        'type', 'reminder',
        'priority', 'MEDIUM',
        'read', false,
        'calendarEventId', event_row.id,
        'startsAt', occurrence,
        'createdAt', now_utc
      ));
      update public.calendar_events set last_reminder_for = occurrence, updated_at = now_utc where id = event_row.id;
      sent_count := sent_count + 1;
    end if;
  end loop;
  return sent_count;
end;
$$;
revoke all on function public.dispatch_calendar_reminders() from public, anon, authenticated;
grant execute on function public.dispatch_calendar_reminders() to service_role;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
