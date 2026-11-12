create table if not exists public.life_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint life_goals_data_object check (jsonb_typeof(data) = 'object'),
  constraint life_goals_title_length check (char_length(trim(coalesce(data ->> 'title', ''))) between 1 and 160),
  constraint life_goals_description_length check (char_length(coalesce(data ->> 'description', '')) <= 5000),
  constraint life_goals_status check (coalesce(data ->> 'status', 'active') in ('active', 'paused', 'completed')),
  constraint life_goals_milestones check (
    not (data ? 'milestones') or
    (jsonb_typeof(data -> 'milestones') = 'array' and jsonb_array_length(data -> 'milestones') <= 50)
  )
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create index if not exists life_goals_user_updated_idx on public.life_goals (user_id, updated_date desc);
create index if not exists life_goals_project_idx on public.life_goals ((data ->> 'project_id'));

alter table public.life_goals enable row level security;
drop policy if exists "Users manage own rows" on public.life_goals;
create policy "Users manage own rows" on public.life_goals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.life_goals from anon;
grant select, insert, update, delete on public.life_goals to authenticated;

create or replace function private.validate_life_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_text text;
  target_date_text text;
  milestone jsonb;
  milestone_date text;
begin
  if (select auth.uid()) is distinct from new.user_id then
    raise exception 'Goal owner does not match the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Goal owner cannot be changed' using errcode = '42501';
  end if;
  if (new.data ? 'title' and jsonb_typeof(new.data -> 'title') is distinct from 'string')
     or (new.data ? 'description' and jsonb_typeof(new.data -> 'description') is distinct from 'string') then
    raise exception 'Goal title and description must be text' using errcode = '23514';
  end if;
  if new.data ? 'status' and (jsonb_typeof(new.data -> 'status') is distinct from 'string'
     or new.data ->> 'status' not in ('active', 'paused', 'completed')) then
    raise exception 'Goal status is invalid' using errcode = '23514';
  end if;

  target_date_text := nullif(new.data ->> 'target_date', '');
  if target_date_text is not null then
    if jsonb_typeof(new.data -> 'target_date') is distinct from 'string'
       or target_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Goal target date is invalid' using errcode = '23514';
    end if;
    begin
      perform target_date_text::date;
    exception when others then
      raise exception 'Goal target date is invalid' using errcode = '23514';
    end;
  end if;

  if new.data ? 'milestones' then
    if jsonb_typeof(new.data -> 'milestones') is distinct from 'array'
       or jsonb_array_length(new.data -> 'milestones') > 50 then
      raise exception 'Goal milestones are invalid' using errcode = '23514';
    end if;
    for milestone in select value from jsonb_array_elements(new.data -> 'milestones') loop
      if jsonb_typeof(milestone) is distinct from 'object'
         or jsonb_typeof(milestone -> 'id') is distinct from 'string'
         or coalesce(milestone ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or jsonb_typeof(milestone -> 'title') is distinct from 'string'
         or char_length(trim(coalesce(milestone ->> 'title', ''))) not between 1 and 160
         or (milestone ? 'complete' and jsonb_typeof(milestone -> 'complete') is distinct from 'boolean') then
        raise exception 'Goal milestone is invalid' using errcode = '23514';
      end if;
      milestone_date := nullif(milestone ->> 'due_date', '');
      if milestone_date is not null then
        if jsonb_typeof(milestone -> 'due_date') is distinct from 'string'
           or milestone_date !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'Goal milestone due date is invalid' using errcode = '23514';
        end if;
        begin
          perform milestone_date::date;
        exception when others then
          raise exception 'Goal milestone due date is invalid' using errcode = '23514';
        end;
      end if;
    end loop;
  end if;

  project_text := nullif(new.data ->> 'project_id', '');
  if project_text is not null then
    if jsonb_typeof(new.data -> 'project_id') is distinct from 'string'
       or project_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Linked project ID is invalid' using errcode = '23503';
    end if;
    if not exists (select 1 from public.projects p where p.id = project_text::uuid and p.user_id = new.user_id) then
      raise exception 'Linked project was not found for this goal owner' using errcode = '23503';
    end if;
  end if;

  new.updated_date := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists life_goals_validate on public.life_goals;
create trigger life_goals_validate before insert or update on public.life_goals
  for each row execute function private.validate_life_goal();
revoke all on function private.validate_life_goal() from public, anon, authenticated;

create or replace function private.unlink_deleted_project_life_goals()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.life_goals g
  set data = (g.data - 'project_title') || jsonb_build_object('project_id', null)
  where g.user_id = old.user_id and g.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

drop trigger if exists projects_unlink_deleted_life_goals on public.projects;
create trigger projects_unlink_deleted_life_goals after delete on public.projects
  for each row execute function private.unlink_deleted_project_life_goals();
revoke all on function private.unlink_deleted_project_life_goals() from public, anon, authenticated;
