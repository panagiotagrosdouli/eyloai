-- Search private file metadata for the signed-in owner. Stored file bytes are
-- never downloaded or inspected by this RPC; only the name and user note are indexed.
create index if not exists eylo_files_private_search_idx
  on public.eylo_files using gin (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  );

create or replace function public.search_private_files(
  p_query text,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  owner_id uuid := (select auth.uid());
  search_terms tsquery;
  total_count bigint;
  result_items jsonb;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_query is null or char_length(btrim(p_query)) < 2 or char_length(p_query) > 200 then
    raise exception using errcode = '22023', message = 'Search query must be between 2 and 200 characters.';
  end if;
  if p_page is null or p_page < 1 or p_page > 10000 then
    raise exception using errcode = '22023', message = 'Invalid search page.';
  end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 50 then
    raise exception using errcode = '22023', message = 'Invalid search page size.';
  end if;

  search_terms := websearch_to_tsquery('simple', btrim(p_query));
  select count(*) into total_count
  from public.eylo_files f
  where f.user_id = owner_id
    and to_tsvector('simple', coalesce(f.name, '') || ' ' || coalesce(f.description, '')) @@ search_terms;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', page.id,
    'title', left(page.name, 240),
    'snippet', left(coalesce(nullif(page.description, ''), page.name), 500),
    'score', page.rank,
    'updated_date', page.updated_at
  ) order by page.rank desc, page.updated_at desc, page.id), '[]'::jsonb)
  into result_items
  from (
    select f.id, f.name, f.description, f.updated_at,
      ts_rank(to_tsvector('simple', coalesce(f.name, '') || ' ' || coalesce(f.description, '')), search_terms) as rank
    from public.eylo_files f
    where f.user_id = owner_id
      and to_tsvector('simple', coalesce(f.name, '') || ' ' || coalesce(f.description, '')) @@ search_terms
    order by rank desc, f.updated_at desc, f.id
    limit p_page_size offset ((p_page - 1) * p_page_size)
  ) page;

  return jsonb_build_object(
    'items', coalesce(result_items, '[]'::jsonb),
    'total', total_count,
    'page', p_page,
    'page_size', p_page_size
  );
end
$function$;

revoke all on function public.search_private_files(text, integer, integer) from public, anon;
grant execute on function public.search_private_files(text, integer, integer) to authenticated;
