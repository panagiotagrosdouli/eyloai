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

-- Different modules/providers may use different source IDs for the same DOI.
-- Preserve DOI suffixes (including version-like suffixes) while normalizing
-- only the documented DOI URL/prefix aliases. Never delete legacy duplicates.
do $$
begin
  if exists (
    select 1 from (
      select user_id, lower(regexp_replace(btrim(data ->> 'doi'), '^(https?://(dx[.])?doi[.]org/|doi:)[[:space:]]*', '', 'i')) as doi
      from public.saved_papers
    ) canonical
    where doi ~ '^10[.][0-9]{4,9}/[^[:space:]]+$'
    group by user_id, doi having count(*) > 1
  ) then raise exception 'Duplicate canonical DOIs exist. Review records before applying the DOI identity index.'; end if;
end $$;
create unique index if not exists saved_papers_user_doi_identity_unique
  on public.saved_papers(user_id, (lower(regexp_replace(btrim(data ->> 'doi'), '^(https?://(dx[.])?doi[.]org/|doi:)[[:space:]]*', '', 'i'))))
  where lower(regexp_replace(btrim(data ->> 'doi'), '^(https?://(dx[.])?doi[.]org/|doi:)[[:space:]]*', '', 'i')) ~ '^10[.][0-9]{4,9}/[^[:space:]]+$';
