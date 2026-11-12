create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now())
);

create index if not exists activity_events_owner_date_idx on public.activity_events (user_id, created_date desc);
alter table public.activity_events enable row level security;
drop policy if exists "Users read own activity" on public.activity_events;
create policy "Users read own activity" on public.activity_events for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users clear own activity" on public.activity_events;
create policy "Users clear own activity" on public.activity_events for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.activity_events from anon, authenticated;
grant select, delete on public.activity_events to authenticated;

create or replace function private.capture_activity_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  record_data jsonb;
  owner_id uuid;
  entity_id uuid;
  entity_label text;
  operation text;
begin
  -- Ignore timestamp-only writes and autosave no-ops; audit content changes,
  -- not repeated writes of identical user data.
  if tg_op = 'UPDATE' and old.data is not distinct from new.data then
    return new;
  end if;
  if tg_op = 'DELETE' then
    record_data := old.data;
    owner_id := old.user_id;
    entity_id := old.id;
    operation := 'deleted';
  else
    record_data := new.data;
    owner_id := new.user_id;
    entity_id := new.id;
    operation := case when tg_op = 'INSERT' then 'created' else 'updated' end;
  end if;
  -- Skip background cascades and privileged maintenance writes. In particular,
  -- account deletion must not be blocked by a new log row referencing that user.
  if owner_id is null or (select auth.uid()) is distinct from owner_id then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  entity_label := left(coalesce(nullif(record_data ->> 'title', ''), nullif(record_data ->> 'name', ''), tg_table_name), 160);
  insert into public.activity_events (user_id, data)
  values (owner_id, jsonb_build_object(
    'action', operation,
    'entity_type', tg_table_name,
    'entity_id', entity_id,
    'entity_label', entity_label
  ));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.capture_activity_event() from public, anon, authenticated;

drop trigger if exists capture_activity_notes on public.notes;
create trigger capture_activity_notes after insert or update or delete on public.notes
for each row execute function private.capture_activity_event();
drop trigger if exists capture_activity_life_tasks on public.life_tasks;
create trigger capture_activity_life_tasks after insert or update or delete on public.life_tasks
for each row execute function private.capture_activity_event();
drop trigger if exists capture_activity_life_goals on public.life_goals;
create trigger capture_activity_life_goals after insert or update or delete on public.life_goals
for each row execute function private.capture_activity_event();
drop trigger if exists capture_activity_flashcards on public.study_flashcard_decks;
create trigger capture_activity_flashcards after insert or update or delete on public.study_flashcard_decks
for each row execute function private.capture_activity_event();
drop trigger if exists capture_activity_calendar_events on public.calendar_events;
create trigger capture_activity_calendar_events after insert or update or delete on public.calendar_events
for each row execute function private.capture_activity_event();
drop trigger if exists capture_activity_projects on public.projects;
create trigger capture_activity_projects after insert or update or delete on public.projects
for each row execute function private.capture_activity_event();

