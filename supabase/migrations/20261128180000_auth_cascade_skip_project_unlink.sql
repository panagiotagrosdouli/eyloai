-- During Auth account deletion, the account's projects and project-linked
-- records are all removed through their own user_id cascades. Project unlink
-- triggers would otherwise UPDATE those child tables as supabase_auth_admin,
-- expanding its write privileges beyond the narrow cascade grants. Keep the
-- unlink behavior for ordinary project deletion and skip only the redundant
-- update during the Auth deletion transaction.
create or replace function private.unlink_deleted_project_notes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' then
    return old;
  end if;
  update public.notes n
  set data = (n.data - 'project_title') || jsonb_build_object('project_id', null)
  where n.user_id = old.user_id
    and n.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

create or replace function private.unlink_deleted_project_life_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' then
    return old;
  end if;
  update public.life_tasks t
  set data = (t.data - 'project_title') || jsonb_build_object('project_id', null)
  where t.user_id = old.user_id
    and t.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

create or replace function private.unlink_deleted_project_life_goals()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' then
    return old;
  end if;
  update public.life_goals g
  set data = (g.data - 'project_title') || jsonb_build_object('project_id', null)
  where g.user_id = old.user_id
    and g.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

create or replace function private.unlink_deleted_project_flashcard_decks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' then
    return old;
  end if;
  update public.study_flashcard_decks d
  set data = (d.data - 'project_title') || jsonb_build_object('project_id', null)
  where d.user_id = old.user_id
    and d.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;
