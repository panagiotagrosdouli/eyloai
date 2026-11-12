-- Bounded, authenticated full-text search for private workspace records.
-- Apply after the EYLO Notes, Life, Calendar, Flashcards and Activity migrations.
do $indexes$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects', 'ideas', 'saved_papers', 'notes', 'life_tasks',
    'life_goals', 'study_flashcard_decks', 'calendar_events'
  ] loop
    execute format(
      'create index if not exists %I on public.%I using gin (to_tsvector(''simple'', coalesce(data::text, '''')))',
      table_name || '_workspace_search_fts_idx', table_name
    );
  end loop;
end
$indexes$;

create or replace function public.search_workspace_records(
  p_source text,
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
  table_name text;
  search_terms tsquery;
  total_count bigint;
  result_items jsonb;
  page_number integer;
  bounded_page_size integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_source is null or p_source not in ('Project','Idea','SavedPaper','Note','LifeTask','LifeGoal','FlashcardDeck','CalendarEvent') then
    raise exception using errcode = '22023', message = 'Unsupported workspace search source.';
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

  table_name := case p_source
    when 'Project' then 'projects'
    when 'Idea' then 'ideas'
    when 'SavedPaper' then 'saved_papers'
    when 'Note' then 'notes'
    when 'LifeTask' then 'life_tasks'
    when 'LifeGoal' then 'life_goals'
    when 'FlashcardDeck' then 'study_flashcard_decks'
    when 'CalendarEvent' then 'calendar_events'
  end;
  search_terms := websearch_to_tsquery('simple', btrim(p_query));
  page_number := p_page;
  bounded_page_size := p_page_size;

  execute format(
    'select count(*) from public.%I r where r.user_id = $1 and to_tsvector(''simple'', coalesce(r.data::text, '''')) @@ $2',
    table_name
  ) into total_count using (select auth.uid()), search_terms;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(
       ''id'', page.id,
       ''title'', left(coalesce(nullif(page.data ->> ''title'', ''''), nullif(page.data ->> ''name'', ''''), ''Untitled record''), 240),
       ''snippet'', left(coalesce(page.data ->> ''content'', page.data ->> ''description'', page.data ->> ''abstract'', page.data ->> ''title'', ''''), 500),
       ''area'', page.data ->> ''area'',
       ''score'', page.rank,
       ''updated_date'', page.updated_date
     ) order by page.rank desc, page.updated_date desc, page.id), ''[]''::jsonb)
     from (
       select r.id, r.data, r.updated_date,
         ts_rank(to_tsvector(''simple'', coalesce(r.data::text, '''')), $2) as rank
       from public.%I r
       where r.user_id = $1 and to_tsvector(''simple'', coalesce(r.data::text, '''')) @@ $2
       order by rank desc, r.updated_date desc, r.id
       limit $3 offset $4
     ) page',
    table_name
  ) into result_items using (select auth.uid()), search_terms, bounded_page_size, (page_number - 1) * bounded_page_size;

  return jsonb_build_object(
    'items', coalesce(result_items, '[]'::jsonb),
    'total', total_count,
    'page', page_number,
    'page_size', bounded_page_size
  );
end
$function$;

revoke all on function public.search_workspace_records(text, text, integer, integer) from public, anon;
grant execute on function public.search_workspace_records(text, text, integer, integer) to authenticated;
