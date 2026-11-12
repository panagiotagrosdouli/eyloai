create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint calendar_events_data_object check (jsonb_typeof(data) = 'object'),
  constraint calendar_events_title_length check (char_length(trim(coalesce(data ->> 'title', ''))) between 1 and 160),
  constraint calendar_events_description_length check (char_length(coalesce(data ->> 'description', '')) <= 4000),
  constraint calendar_events_recurrence check (coalesce(data ->> 'recurrence', 'none') in ('none', 'daily', 'weekly', 'monthly'))
);

create index if not exists calendar_events_user_start_idx on public.calendar_events (user_id, ((data ->> 'start_at')));
create index if not exists calendar_events_project_idx on public.calendar_events ((data ->> 'project_id'));
alter table public.calendar_events enable row level security;
drop policy if exists "Users manage own rows" on public.calendar_events;
create policy "Users manage own rows" on public.calendar_events for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.calendar_events from anon;
grant select, insert, update, delete on public.calendar_events to authenticated;

create or replace function private.validate_calendar_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_text text;
begin
  if (select auth.uid()) is distinct from new.user_id then
    raise exception 'Event owner does not match the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Event owner cannot be changed' using errcode = '42501';
  end if;
  if coalesce(new.data ->> 'title', '') = '' or char_length(new.data ->> 'title') > 160 then
    raise exception 'Event title is invalid' using errcode = '23514';
  end if;
  if coalesce(new.data ->> 'recurrence', 'none') not in ('none', 'daily', 'weekly', 'monthly') then
    raise exception 'Event recurrence is invalid' using errcode = '23514';
  end if;
  if coalesce(new.data ->> 'start_at', '') !~ '^\d{4}-\d{2}-\d{2}T' or coalesce(new.data ->> 'end_at', '') !~ '^\d{4}-\d{2}-\d{2}T'
     or (new.data ->> 'end_at')::timestamptz <= (new.data ->> 'start_at')::timestamptz then
    raise exception 'Event date range is invalid' using errcode = '23514';
  end if;
  if nullif(new.data ->> 'reminder_at', '') is not null and (new.data ->> 'reminder_at')::timestamptz >= (new.data ->> 'end_at')::timestamptz then
    raise exception 'Reminder must precede event end' using errcode = '23514';
  end if;
  project_text := nullif(new.data ->> 'project_id', '');
  if project_text is not null and not exists (
    select 1 from public.projects p where p.id::text = project_text and p.user_id = new.user_id
  ) then
    raise exception 'Event project must belong to its owner' using errcode = '23514';
  end if;
  new.updated_date := timezone('utc', now());
  return new;
end;
$$;
revoke all on function private.validate_calendar_event() from public, anon, authenticated;
drop trigger if exists validate_calendar_event on public.calendar_events;
create trigger validate_calendar_event before insert or update on public.calendar_events
for each row execute function private.validate_calendar_event();
