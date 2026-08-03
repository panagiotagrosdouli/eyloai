do $$
declare table_name text;
begin
  foreach table_name in array array['watchlists','monitoring_discoveries','notifications']
  loop
    execute format('create table if not exists public.%I (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null default ''{}''::jsonb,
      created_date timestamptz not null default timezone(''utc'', now()),
      updated_date timestamptz not null default timezone(''utc'', now())
    )', table_name);
    execute format('create index if not exists %I on public.%I (user_id, updated_date desc)', table_name || '_user_updated_idx', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Users manage own rows" on public.%I', table_name);
    execute format('create policy "Users manage own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_date', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_date()', table_name || '_set_updated_date', table_name);
  end loop;
end $$;

create index if not exists monitoring_discoveries_external_idx
  on public.monitoring_discoveries (user_id, (data ->> 'externalId'));
create index if not exists notifications_unread_idx
  on public.notifications (user_id, ((data ->> 'read')::boolean));

grant select, insert, update, delete on public.watchlists, public.monitoring_discoveries, public.notifications to authenticated;
