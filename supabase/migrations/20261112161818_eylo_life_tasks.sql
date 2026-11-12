create table if not exists public.life_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint life_tasks_data_object check (jsonb_typeof(data) = 'object'),
  constraint life_tasks_title_length check (char_length(trim(coalesce(data ->> 'title', ''))) between 1 and 160),
  constraint life_tasks_description_length check (char_length(coalesce(data ->> 'description', '')) <= 5000),
  constraint life_tasks_status check (coalesce(data ->> 'status', 'todo') in ('todo', 'in_progress', 'done')),
  constraint life_tasks_priority check (coalesce(data ->> 'priority', 'normal') in ('low', 'normal', 'high', 'urgent')),
  constraint life_tasks_recurrence check (coalesce(data ->> 'recurrence', 'none') in ('none', 'daily', 'weekly', 'monthly')),
  constraint life_tasks_area check (coalesce(data ->> 'area', 'personal') in ('personal', 'research', 'study', 'work')),
  constraint life_tasks_kind check (coalesce(data ->> 'kind', 'task') in ('task', 'study', 'syllabus', 'exam', 'habit')),
  constraint life_tasks_course_length check (char_length(coalesce(data ->> 'course', '')) <= 160),
  constraint life_tasks_syllabus_length check (char_length(coalesce(data ->> 'syllabus_item', '')) <= 200)
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create index if not exists life_tasks_user_updated_idx on public.life_tasks (user_id, updated_date desc);
create index if not exists life_tasks_due_idx on public.life_tasks (user_id, (data ->> 'due_date'));
create index if not exists life_tasks_project_idx on public.life_tasks ((data ->> 'project_id'));
create unique index if not exists life_tasks_recurrence_instance_idx
  on public.life_tasks (user_id, (data ->> 'recurrence_parent_id'), (data ->> 'recurrence_instance_date'))
  where nullif(data ->> 'recurrence_parent_id', '') is not null
    and nullif(data ->> 'recurrence_instance_date', '') is not null;

alter table public.life_tasks enable row level security;
drop policy if exists "Users manage own rows" on public.life_tasks;
create policy "Users manage own rows" on public.life_tasks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.life_tasks from anon;
grant select, insert, update, delete on public.life_tasks to authenticated;

create or replace function private.validate_life_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_text text;
  due_date_text text;
  occurrence_date_text text;
  recurrence text;
begin
  if (select auth.uid()) is distinct from new.user_id then
    raise exception 'Task owner does not match the authenticated user' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'Task owner cannot be changed' using errcode = '42501';
  end if;

  if (new.data ? 'title' and jsonb_typeof(new.data -> 'title') is distinct from 'string')
     or (new.data ? 'description' and jsonb_typeof(new.data -> 'description') is distinct from 'string') then
    raise exception 'Task title and description must be text' using errcode = '23514';
  end if;
  if new.data ? 'status' and (jsonb_typeof(new.data -> 'status') is distinct from 'string'
     or new.data ->> 'status' not in ('todo', 'in_progress', 'done')) then
    raise exception 'Task status is invalid' using errcode = '23514';
  end if;
  if new.data ? 'priority' and (jsonb_typeof(new.data -> 'priority') is distinct from 'string'
     or new.data ->> 'priority' not in ('low', 'normal', 'high', 'urgent')) then
    raise exception 'Task priority is invalid' using errcode = '23514';
  end if;
  if new.data ? 'recurrence' and (jsonb_typeof(new.data -> 'recurrence') is distinct from 'string'
     or new.data ->> 'recurrence' not in ('none', 'daily', 'weekly', 'monthly')) then
    raise exception 'Task recurrence is invalid' using errcode = '23514';
  end if;
  if new.data ? 'area' and (jsonb_typeof(new.data -> 'area') is distinct from 'string'
     or new.data ->> 'area' not in ('personal', 'research', 'study', 'work')) then
    raise exception 'Task area is invalid' using errcode = '23514';
  end if;
  if new.data ? 'kind' and (jsonb_typeof(new.data -> 'kind') is distinct from 'string'
     or new.data ->> 'kind' not in ('task', 'study', 'syllabus', 'exam', 'habit')) then
    raise exception 'Task kind is invalid' using errcode = '23514';
  end if;
  if (new.data ? 'course' and jsonb_typeof(new.data -> 'course') is distinct from 'string')
     or (new.data ? 'syllabus_item' and jsonb_typeof(new.data -> 'syllabus_item') is distinct from 'string') then
    raise exception 'Course and syllabus item must be text' using errcode = '23514';
  end if;

  recurrence := coalesce(new.data ->> 'recurrence', 'none');
  if new.data ->> 'kind' = 'habit' and recurrence not in ('daily', 'weekly') then
    raise exception 'Habits must repeat daily or weekly' using errcode = '23514';
  end if;
  due_date_text := nullif(new.data ->> 'due_date', '');
  if recurrence <> 'none' and due_date_text is null then
    raise exception 'Recurring tasks require a due date' using errcode = '23514';
  end if;
  if due_date_text is not null then
    if jsonb_typeof(new.data -> 'due_date') is distinct from 'string' or due_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Task due date is invalid' using errcode = '23514';
    end if;
    begin
      perform due_date_text::date;
    exception when others then
      raise exception 'Task due date is invalid' using errcode = '23514';
    end;
  end if;

  if nullif(new.data ->> 'recurrence_parent_id', '') is not null then
    occurrence_date_text := nullif(new.data ->> 'recurrence_instance_date', '');
    if (new.data ->> 'recurrence_parent_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or occurrence_date_text is null
       or occurrence_date_text !~ '^\d{4}-\d{2}-\d{2}$'
       or occurrence_date_text is distinct from due_date_text then
      raise exception 'Recurring task occurrence metadata is invalid' using errcode = '23514';
    end if;
    begin
      perform occurrence_date_text::date;
    exception when others then
      raise exception 'Recurring task occurrence date is invalid' using errcode = '23514';
    end;
  end if;

  project_text := nullif(new.data ->> 'project_id', '');
  if project_text is not null then
    if jsonb_typeof(new.data -> 'project_id') is distinct from 'string'
       or project_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Linked project ID is invalid' using errcode = '23503';
    end if;
    if not exists (
      select 1 from public.projects p
      where p.id = project_text::uuid and p.user_id = new.user_id
    ) then
      raise exception 'Linked project was not found for this task owner' using errcode = '23503';
    end if;
  end if;

  new.updated_date := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists life_tasks_validate on public.life_tasks;
create trigger life_tasks_validate before insert or update on public.life_tasks
  for each row execute function private.validate_life_task();
revoke all on function private.validate_life_task() from public, anon, authenticated;

create or replace function private.unlink_deleted_project_life_tasks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.life_tasks t
  set data = (t.data - 'project_title') || jsonb_build_object('project_id', null)
  where t.user_id = old.user_id
    and t.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;

drop trigger if exists projects_unlink_deleted_life_tasks on public.projects;
create trigger projects_unlink_deleted_life_tasks after delete on public.projects
  for each row execute function private.unlink_deleted_project_life_tasks();
revoke all on function private.unlink_deleted_project_life_tasks() from public, anon, authenticated;
