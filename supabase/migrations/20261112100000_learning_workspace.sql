create table if not exists public.learning_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'note', 'goal', 'habit', 'life_task', 'subject', 'study_session',
    'deck', 'flashcard', 'quiz', 'quiz_attempt', 'notebook'
  )),
  parent_id uuid,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  constraint learning_records_parent_owner_fk
    foreign key (parent_id, user_id) references public.learning_records(id, user_id) on delete cascade
);

create index if not exists learning_records_user_kind_updated_idx
  on public.learning_records (user_id, kind, updated_date desc);
create index if not exists learning_records_parent_idx
  on public.learning_records (parent_id) where parent_id is not null;

alter table public.learning_records enable row level security;
drop policy if exists "Users manage own learning records" on public.learning_records;
create policy "Users manage own learning records" on public.learning_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists learning_records_set_updated_date on public.learning_records;
create trigger learning_records_set_updated_date before update on public.learning_records
  for each row execute function public.set_updated_date();

grant select, insert, update, delete on public.learning_records to authenticated;

create table if not exists public.learning_record_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_date timestamptz not null default timezone('utc', now()),
  unique (note_id, version_number),
  foreign key (note_id, user_id) references public.learning_records(id, user_id) on delete cascade
);

create index if not exists learning_record_versions_owner_note_idx
  on public.learning_record_versions (user_id, note_id, version_number desc);
alter table public.learning_record_versions enable row level security;
drop policy if exists "Users read own note versions" on public.learning_record_versions;
create policy "Users read own note versions" on public.learning_record_versions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users add own note versions" on public.learning_record_versions;
create policy "Users add own note versions" on public.learning_record_versions
  for insert to authenticated with check ((select auth.uid()) = user_id);
grant select, insert on public.learning_record_versions to authenticated;

create or replace function public.capture_learning_note_version()
returns trigger language plpgsql set search_path = '' as $$
declare next_version integer;
begin
  if new.kind <> 'note' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.data is not distinct from old.data then
    return new;
  end if;
  select coalesce(max(version_number), 0) + 1 into next_version
    from public.learning_record_versions
    where note_id = new.id and user_id = new.user_id;
  insert into public.learning_record_versions (note_id, user_id, version_number, snapshot)
    values (new.id, new.user_id, next_version, new.data);
  return new;
end;
$$;

drop trigger if exists learning_note_version_on_create on public.learning_records;
create trigger learning_note_version_on_create after insert on public.learning_records
  for each row when (new.kind = 'note') execute function public.capture_learning_note_version();
drop trigger if exists learning_note_version_on_update on public.learning_records;
create trigger learning_note_version_on_update after update of data on public.learning_records
  for each row when (new.kind = 'note') execute function public.capture_learning_note_version();
