-- Keep the analytics RPC aligned with the profiles table created by the
-- canonical EYLO migration (user_id + JSONB data + created_date).
-- This is additive and preserves all existing project/profile rows.

create or replace function private.get_workspace_analytics_internal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  selected_membership public.institution_memberships%rowtype;
  member_ids uuid[];
  member_count integer := 1;
  workspace_scope text := 'personal';
  workspace_id text;
  workspace_name text;
  usage_count integer := 0;
  counts jsonb;
begin
  if requester is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
    into selected_membership
    from public.institution_memberships
   where user_id = requester
     and status = 'active'
     and role in ('admin', 'owner')
   order by created_at asc
   limit 1;

  if found then
    workspace_scope := 'institution';
    workspace_id := selected_membership.institution_id;
    workspace_name := selected_membership.institution_name;
    select coalesce(array_agg(user_id), array[requester]::uuid[]), count(*)::integer
      into member_ids, member_count
      from public.institution_memberships
     where institution_id = selected_membership.institution_id
       and status = 'active';
  else
    member_ids := array[requester]::uuid[];
    workspace_id := requester::text;
    select coalesce(
      nullif(profile.data ->> 'organization', ''),
      nullif(profile.data ->> 'full_name', ''),
      'My workspace'
    )
      into workspace_name
      from public.profiles as profile
     where profile.user_id = requester
     limit 1;
    workspace_name := coalesce(workspace_name, 'My workspace');
  end if;

  select jsonb_build_object(
    'projects', (select count(*) from public.projects where user_id = any(member_ids)),
    'saved_papers', (select count(*) from public.saved_papers where user_id = any(member_ids)),
    'saved_researchers', (select count(*) from public.saved_researchers where user_id = any(member_ids)),
    'saved_opportunities', (select count(*) from public.saved_opportunities where user_id = any(member_ids)),
    'meetings', (select count(*) from public.meetings where user_id = any(member_ids)),
    'watchlists', (select count(*) from public.watchlists where user_id = any(member_ids))
  ) into counts;

  if to_regclass('public.eyra_usage_actions') is not null then
    execute 'select count(*)::integer from public.eyra_usage_actions where user_id = any($1) and usage_month = $2'
      into usage_count
      using member_ids, to_char(timezone('utc', now()), 'YYYY-MM');
  end if;

  return jsonb_build_object(
    'scope', workspace_scope,
    'institution_id', workspace_id,
    'institution_name', workspace_name,
    'members', member_count,
    'ai_actions_this_month', usage_count,
    'counts', counts,
    'generated_at', timezone('utc', now())
  );
end;
$$;

revoke all on function private.get_workspace_analytics_internal() from public, anon;
grant execute on function private.get_workspace_analytics_internal() to authenticated;

-- Scheduled monitoring uses the service-role key; keep these privileges
-- explicit so project-wide default grants do not determine runtime behavior.
grant select, insert, update, delete
  on public.watchlists, public.monitoring_discoveries, public.notifications
  to service_role;
