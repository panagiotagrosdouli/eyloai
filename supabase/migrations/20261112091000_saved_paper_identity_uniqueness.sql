-- The live literature save flow uses a stable per-user identity. Refuse to
-- silently delete existing researcher data if legacy duplicates exist; the
-- deployment owner must review and resolve those records before applying.
do $$
begin
  if exists (
    select 1
    from public.saved_papers
    where nullif(btrim(data ->> 'source_id'), '') is not null
    group by user_id, data ->> 'source_id'
    having count(*) > 1
  ) then
    raise exception 'Duplicate saved-paper source IDs exist. Review and resolve duplicates before applying the saved-paper identity migration.';
  end if;
end $$;

create unique index if not exists saved_papers_user_source_identity_unique
  on public.saved_papers (user_id, (data ->> 'source_id'))
  where nullif(btrim(data ->> 'source_id'), '') is not null;
