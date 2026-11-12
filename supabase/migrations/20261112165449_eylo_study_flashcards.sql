create table if not exists public.study_flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint study_flashcard_decks_data_object check (jsonb_typeof(data) = 'object'),
  constraint study_flashcard_decks_title_length check (char_length(trim(coalesce(data ->> 'title', ''))) between 1 and 120),
  constraint study_flashcard_decks_description_length check (char_length(coalesce(data ->> 'description', '')) <= 2000),
  constraint study_flashcard_decks_course check (not (data ? 'course') or (jsonb_typeof(data -> 'course') = 'string' and char_length(data ->> 'course') <= 160)),
  constraint study_flashcard_decks_cards check (
    not (data ? 'cards') or
    (jsonb_typeof(data -> 'cards') = 'array' and jsonb_array_length(data -> 'cards') <= 500)
  )
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create index if not exists study_flashcard_decks_user_updated_idx
  on public.study_flashcard_decks (user_id, updated_date desc);
create index if not exists study_flashcard_decks_project_idx
  on public.study_flashcard_decks ((data ->> 'project_id'));
create index if not exists study_flashcard_decks_course_idx
  on public.study_flashcard_decks ((data ->> 'course'));

alter table public.study_flashcard_decks enable row level security;
drop policy if exists "Users manage own rows" on public.study_flashcard_decks;
create policy "Users manage own rows" on public.study_flashcard_decks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.study_flashcard_decks from anon;
grant select, insert, update, delete on public.study_flashcard_decks to authenticated;

create or replace function private.validate_study_flashcard_deck()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_text text;
  card jsonb;
  card_id text;
  seen_card_ids text[] := array[]::text[];
  due_date_text text;
  last_reviewed_text text;
  card_interval numeric;
  repetitions numeric;
  ease_factor numeric;
begin
  if (select auth.uid()) is distinct from new.user_id then
    raise exception 'Deck owner does not match the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Deck owner cannot be changed' using errcode = '42501';
  end if;
  if (new.data ? 'title' and jsonb_typeof(new.data -> 'title') is distinct from 'string')
     or (new.data ? 'description' and jsonb_typeof(new.data -> 'description') is distinct from 'string') then
    raise exception 'Deck title and description must be text' using errcode = '23514';
  end if;

  if new.data ? 'cards' then
    if jsonb_typeof(new.data -> 'cards') is distinct from 'array'
       or jsonb_array_length(new.data -> 'cards') > 500 then
      raise exception 'Deck cards are invalid or exceed the maximum of 500' using errcode = '23514';
    end if;
    for card in select value from jsonb_array_elements(new.data -> 'cards') loop
      card_id := card ->> 'id';
      if jsonb_typeof(card) is distinct from 'object'
         or jsonb_typeof(card -> 'id') is distinct from 'string'
         or coalesce(card_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or lower(card_id) = any(seen_card_ids)
         or jsonb_typeof(card -> 'front') is distinct from 'string'
         or char_length(trim(coalesce(card ->> 'front', ''))) not between 1 and 2000
         or jsonb_typeof(card -> 'back') is distinct from 'string'
         or char_length(trim(coalesce(card ->> 'back', ''))) not between 1 and 5000 then
        raise exception 'Flashcard content or identifier is invalid' using errcode = '23514';
      end if;
      seen_card_ids := array_append(seen_card_ids, lower(card_id));

      card_interval := coalesce((card ->> 'interval')::numeric, 0);
      repetitions := coalesce((card ->> 'repetitions')::numeric, 0);
      ease_factor := coalesce((card ->> 'ease_factor')::numeric, 2.5);
      if card_interval < 0 or card_interval > 36500 or card_interval <> trunc(card_interval)
         or repetitions < 0 or repetitions > 100000 or repetitions <> trunc(repetitions)
         or ease_factor < 1.3 or ease_factor > 3.0 then
        raise exception 'Flashcard review schedule is invalid' using errcode = '23514';
      end if;

      due_date_text := nullif(card ->> 'due_date', '');
      if due_date_text is not null then
        if jsonb_typeof(card -> 'due_date') is distinct from 'string'
           or due_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Flashcard due date is invalid' using errcode = '23514';
        end if;
        begin
          perform due_date_text::date;
        exception when others then
          raise exception 'Flashcard due date is invalid' using errcode = '23514';
        end;
      end if;
      last_reviewed_text := nullif(card ->> 'last_reviewed_date', '');
      if last_reviewed_text is not null then
        if jsonb_typeof(card -> 'last_reviewed_date') is distinct from 'string'
           or last_reviewed_text !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Flashcard review date is invalid' using errcode = '23514';
        end if;
        begin
          perform last_reviewed_text::date;
        exception when others then
          raise exception 'Flashcard review date is invalid' using errcode = '23514';
        end;
      end if;
    end loop;
  end if;

  if new.data ? 'course' and jsonb_typeof(new.data -> 'course') is distinct from 'string' then
    raise exception 'Course must be text' using errcode = '23514';
  end if;

  project_text := nullif(new.data ->> 'project_id', '');
  if project_text is not null then
    if jsonb_typeof(new.data -> 'project_id') is distinct from 'string'
       or project_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Linked project ID is invalid' using errcode = '23503';
    end if;
    if not exists (select 1 from public.projects p where p.id = project_text::uuid and p.user_id = new.user_id) then
      raise exception 'Linked project was not found for this deck owner' using errcode = '23503';
    end if;
  end if;

  new.updated_date := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists study_flashcard_decks_validate on public.study_flashcard_decks;
create trigger study_flashcard_decks_validate before insert or update on public.study_flashcard_decks
  for each row execute function private.validate_study_flashcard_deck();
revoke all on function private.validate_study_flashcard_deck() from public, anon, authenticated;

create or replace function private.unlink_deleted_project_flashcard_decks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.study_flashcard_decks d
  set data = (d.data - 'project_title') || jsonb_build_object('project_id', null)
  where d.user_id = old.user_id and d.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

drop trigger if exists projects_unlink_deleted_flashcard_decks on public.projects;
create trigger projects_unlink_deleted_flashcard_decks after delete on public.projects
  for each row execute function private.unlink_deleted_project_flashcard_decks();
revoke all on function private.unlink_deleted_project_flashcard_decks() from public, anon, authenticated;
