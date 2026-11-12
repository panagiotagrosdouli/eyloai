create table if not exists public.learning_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'note', 'goal', 'habit', 'life_task', 'subject', 'study_session',
    'deck', 'flashcard', 'quiz', 'quiz_attempt'
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
