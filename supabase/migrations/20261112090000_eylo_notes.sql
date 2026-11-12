create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled note' check (char_length(title) between 1 and 200),
  content text not null default '',
  notebook text not null default 'Personal' check (char_length(notebook) between 1 and 100),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_owner_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_tags_idx on public.notes using gin(tags);
alter table public.notes enable row level security;
drop policy if exists "Users manage own notes" on public.notes;
create policy "Users manage own notes" on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  notebook text not null,
  tags text[] not null default '{}',
  saved_at timestamptz not null default now()
);
create index if not exists note_versions_owner_idx on public.note_versions (user_id, note_id, saved_at desc);
alter table public.note_versions enable row level security;
drop policy if exists "Users read own note versions" on public.note_versions;
create policy "Users read own note versions" on public.note_versions
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.capture_note_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.title is distinct from new.title
    or old.content is distinct from new.content
    or old.notebook is distinct from new.notebook
    or old.tags is distinct from new.tags then
    insert into public.note_versions(note_id, user_id, title, content, notebook, tags)
    values (old.id, old.user_id, old.title, old.content, old.notebook, old.tags);
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists notes_capture_version on public.notes;
create trigger notes_capture_version before update on public.notes
for each row execute function public.capture_note_version();
revoke all on function public.capture_note_version() from public, anon, authenticated;

grant select, insert, update, delete on public.notes to authenticated;
grant select on public.note_versions to authenticated;
