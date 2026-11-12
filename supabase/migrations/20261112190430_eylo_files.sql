create table if not exists public.eylo_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null check (char_length(name) between 1 and 240),
  description text not null default '' check (char_length(description) <= 2000),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.eylo_file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  created_at timestamptz not null default now(),
  constraint eylo_file_versions_parent_owner_fk
    foreign key (file_id, user_id) references public.eylo_files(id, user_id) on delete cascade,
  unique (file_id, version_number)
);

create index if not exists eylo_files_user_updated_idx on public.eylo_files (user_id, updated_at desc);
create index if not exists eylo_files_user_project_idx on public.eylo_files (user_id, project_id);
create index if not exists eylo_file_versions_owner_idx on public.eylo_file_versions (user_id, file_id, version_number desc);

alter table public.eylo_files enable row level security;
alter table public.eylo_file_versions enable row level security;

drop policy if exists "Users manage own EYLO files" on public.eylo_files;
create policy "Users manage own EYLO files" on public.eylo_files
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = project_id and p.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Users read own EYLO file versions" on public.eylo_file_versions;
create policy "Users read own EYLO file versions" on public.eylo_file_versions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users add own EYLO file versions" on public.eylo_file_versions;
create policy "Users add own EYLO file versions" on public.eylo_file_versions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.eylo_files f
      where f.id = file_id and f.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.eylo_files to authenticated;
grant select, insert on public.eylo_file_versions to authenticated;

create or replace function public.set_eylo_file_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists eylo_files_set_updated_at on public.eylo_files;
create trigger eylo_files_set_updated_at before update on public.eylo_files
for each row execute function public.set_eylo_file_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'eylo-files', 'eylo-files', false, 26214400,
  array[
    'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json',
    'application/rtf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet', 'application/octet-stream',
    'image/png', 'image/jpeg', 'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "EYLO file owner can read objects" on storage.objects;
create policy "EYLO file owner can read objects" on storage.objects
  for select to authenticated using (
    bucket_id = 'eylo-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "EYLO file owner can upload objects" on storage.objects;
create policy "EYLO file owner can upload objects" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'eylo-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "EYLO file owner can delete objects" on storage.objects;
create policy "EYLO file owner can delete objects" on storage.objects
  for delete to authenticated using (
    bucket_id = 'eylo-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
