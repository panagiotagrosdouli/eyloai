-- Harden legacy trigger helpers and make ownership policies explicit and
-- efficient. All user-data access remains restricted to auth.uid().

alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects', 'ideas', 'meetings', 'saved_papers',
    'saved_researchers', 'saved_opportunities', 'search_history'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_delete', table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'billing_entitlements', 'stripe_webhook_events',
    'eyra_usage_actions', 'institution_memberships'
  ]
  loop
    execute format('drop policy if exists "Service role only" on public.%I', table_name);
    execute format(
      'create policy "Service role only" on public.%I for all to service_role using (true) with check (true)',
      table_name
    );
  end loop;
end $$;
