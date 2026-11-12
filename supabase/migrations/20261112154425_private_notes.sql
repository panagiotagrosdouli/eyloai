create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint notes_data_object check (jsonb_typeof(data) = 'object'),
  constraint notes_title_length check (char_length(coalesce(data ->> 'title', '')) between 1 and 200),
  constraint notes_content_length check (char_length(coalesce(data ->> 'content', '')) <= 100000),
  constraint notes_tags_array check (not (data ? 'tags') or jsonb_typeof(data -> 'tags') is not distinct from 'array')
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_date desc);
create index if not exists notes_tags_idx on public.notes using gin ((data -> 'tags'));
create index if not exists notes_search_idx on public.notes using gin (
  to_tsvector('simple', coalesce(data ->> 'title', '') || ' ' || coalesce(data ->> 'content', ''))
);

alter table public.notes enable row level security;
drop policy if exists "Users manage own rows" on public.notes;
create policy "Users manage own rows" on public.notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.notes to authenticated;

create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_date timestamptz not null default timezone('utc', now()),
  unique (note_id, version)
);

create index if not exists note_versions_owner_note_idx
  on public.note_versions (user_id, note_id, version desc);

alter table public.note_versions enable row level security;
drop policy if exists "Users read own note versions" on public.note_versions;
create policy "Users read own note versions" on public.note_versions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.note_versions from anon, authenticated;
grant select on public.note_versions to authenticated;

create or replace function public.capture_note_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_text text;
begin
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Note owner cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version;
  end if;

  if (new.data ? 'title' and jsonb_typeof(new.data -> 'title') is distinct from 'string')
     or (new.data ? 'content' and jsonb_typeof(new.data -> 'content') is distinct from 'string') then
    raise exception 'Note title and content must be text' using errcode = '23514';
  end if;

  if new.data ? 'tags' and jsonb_typeof(new.data -> 'tags') is distinct from 'array' then
    raise exception 'Note tags must be an array' using errcode = '23514';
  end if;

  if new.data ? 'tags' and (
    jsonb_array_length(new.data -> 'tags') > 30
    or exists (
      select 1 from jsonb_array_elements(new.data -> 'tags') as tag(value)
      where jsonb_typeof(tag.value) <> 'string'
        or char_length(trim(tag.value #>> '{}')) = 0
        or char_length(trim(tag.value #>> '{}')) > 40
    )
  ) then
    raise exception 'Note tags are invalid' using errcode = '23514';
  end if;

  if new.data ? 'project_id' and nullif(new.data ->> 'project_id', '') is not null then
    project_text := new.data ->> 'project_id';
    if project_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists (
         select 1 from public.projects p
         where p.id = project_text::uuid and p.user_id = new.user_id
       ) then
      raise exception 'Linked project was not found for this note owner' using errcode = '23503';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.data is distinct from new.data then
    insert into public.note_versions (note_id, user_id, version, snapshot)
    values (old.id, old.user_id, old.version, old.data);

    delete from public.note_versions v
    where v.note_id = old.id
      and v.user_id = old.user_id
      and v.version <= old.version - 50;

    new.version := old.version + 1;
  end if;

  new.updated_date := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists notes_capture_version on public.notes;
create trigger notes_capture_version before insert or update on public.notes
  for each row execute function public.capture_note_version();
revoke all on function public.capture_note_version() from public, anon, authenticated;

create or replace function public.unlink_deleted_project_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notes n
  set data = (n.data - 'project_title') || jsonb_build_object('project_id', null)
  where n.user_id = old.user_id
    and n.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

drop trigger if exists projects_unlink_deleted_notes on public.projects;
create trigger projects_unlink_deleted_notes after delete on public.projects
  for each row execute function public.unlink_deleted_project_notes();
revoke all on function public.unlink_deleted_project_notes() from public, anon, authenticated;

create or replace function public.search_notes(search_query text, result_limit integer default 100)
returns setof public.notes
language sql
stable
security invoker
set search_path = ''
as $$
  select n.*
  from public.notes n
  where auth.uid() is not null
    and char_length(trim(coalesce(search_query, ''))) between 1 and 200
    and to_tsvector('simple', coalesce(n.data ->> 'title', '') || ' ' || coalesce(n.data ->> 'content', ''))
      @@ websearch_to_tsquery('simple', trim(search_query))
  order by ts_rank_cd(
    to_tsvector('simple', coalesce(n.data ->> 'title', '') || ' ' || coalesce(n.data ->> 'content', '')),
    websearch_to_tsquery('simple', trim(search_query))
  ) desc, n.updated_date desc
  limit greatest(1, least(coalesce(result_limit, 100), 100));
$$;

revoke all on function public.search_notes(text, integer) from public, anon;
grant execute on function public.search_notes(text, integer) to authenticated;
