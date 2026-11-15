create table if not exists public.research_datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint research_datasets_data_object check (jsonb_typeof(data) = 'object'),
  constraint research_datasets_metadata_only check (
    data - array['fileName', 'sha256', 'byteLength', 'rowCount', 'columnCount', 'addedAt'] = '{}'::jsonb
  ),
  constraint research_datasets_file_name check (
    jsonb_typeof(data -> 'fileName') is not distinct from 'string'
    and char_length(trim(data ->> 'fileName')) between 1 and 255
    and data ->> 'fileName' !~ '[[:cntrl:]]'
  ),
  constraint research_datasets_hash check (
    not (data ? 'sha256') or data -> 'sha256' = 'null'::jsonb
    or (jsonb_typeof(data -> 'sha256') = 'string' and data ->> 'sha256' ~ '^[a-f0-9]{64}$')
  ),
  constraint research_datasets_dimensions check (
    jsonb_typeof(data -> 'byteLength') = 'number'
    and (data ->> 'byteLength')::numeric between 0 and 5242880
    and (data ->> 'byteLength')::numeric = trunc((data ->> 'byteLength')::numeric)
    and jsonb_typeof(data -> 'rowCount') = 'number'
    and (data ->> 'rowCount')::numeric between 1 and 10000
    and (data ->> 'rowCount')::numeric = trunc((data ->> 'rowCount')::numeric)
    and jsonb_typeof(data -> 'columnCount') = 'number'
    and (data ->> 'columnCount')::numeric between 1 and 50
    and (data ->> 'columnCount')::numeric = trunc((data ->> 'columnCount')::numeric)
  ),
  constraint research_datasets_added_at check (
    jsonb_typeof(data -> 'addedAt') = 'string'
    and (data ->> 'addedAt')::timestamptz is not null
  )
);

create index if not exists research_datasets_user_created_idx
  on public.research_datasets (user_id, created_date desc, id);
create unique index if not exists research_datasets_user_sha256_idx
  on public.research_datasets (user_id, (data ->> 'sha256'))
  where jsonb_typeof(data -> 'sha256') = 'string';

alter table public.research_datasets enable row level security;
drop policy if exists "Users manage own research dataset metadata" on public.research_datasets;
create policy "Users manage own research dataset metadata" on public.research_datasets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.research_datasets from anon;
grant select, insert, update, delete on public.research_datasets to authenticated;

create or replace function private.validate_research_dataset_catalog_entry()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is distinct from new.user_id then
    raise exception 'Dataset metadata owner does not match the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Dataset metadata owner cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    if (select count(*) from public.research_datasets where user_id = new.user_id) >= 100 then
      raise exception 'Research Data Lab catalog is full' using errcode = '54000';
    end if;
  end if;
  new.updated_date = timezone('utc', now());
  return new;
end;
$$;
revoke all on function private.validate_research_dataset_catalog_entry() from public, anon, authenticated;
drop trigger if exists research_datasets_validate_entry on public.research_datasets;
create trigger research_datasets_validate_entry before insert or update on public.research_datasets
  for each row execute function private.validate_research_dataset_catalog_entry();
