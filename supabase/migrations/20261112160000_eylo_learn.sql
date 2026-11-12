create table if not exists public.learning_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  subject text not null default '' check (char_length(subject) <= 160),
  description text not null default '' check (char_length(description) <= 2000),
  source_note_id uuid references public.notes(id) on delete set null,
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists learning_courses_owner_updated_idx on public.learning_courses(user_id, updated_at desc);
create index if not exists learning_courses_source_note_idx on public.learning_courses(user_id, source_note_id) where source_note_id is not null;
alter table public.learning_courses enable row level security;
drop policy if exists "Users manage own learning courses" on public.learning_courses;
create policy "Users manage own learning courses" on public.learning_courses
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (source_note_id is null or exists (select 1 from public.notes n where n.id = source_note_id and n.user_id = (select auth.uid()))));
grant select, insert, update, delete on public.learning_courses to authenticated;
drop trigger if exists learning_courses_touch_updated_at on public.learning_courses;
create trigger learning_courses_touch_updated_at before update on public.learning_courses
for each row execute function public.touch_quiz_updated_at();

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  objective text not null check (char_length(btrim(objective)) between 1 and 500),
  content text not null check (char_length(btrim(content)) between 1 and 8000),
  position integer not null check (position >= 0),
  quiz_id uuid references public.quizzes(id) on delete set null,
  pass_threshold smallint not null default 60 check (pass_threshold between 0 and 100),
  created_at timestamptz not null default now(),
  foreign key (course_id, user_id) references public.learning_courses(id, user_id) on delete cascade,
  unique (course_id, position),
  unique (id, course_id, user_id)
);
create index if not exists learning_lessons_owner_course_idx on public.learning_lessons(user_id, course_id, position);
create index if not exists learning_lessons_quiz_idx on public.learning_lessons(user_id, quiz_id) where quiz_id is not null;
alter table public.learning_lessons enable row level security;
drop policy if exists "Users manage own learning lessons" on public.learning_lessons;
create policy "Users manage own learning lessons" on public.learning_lessons
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.learning_courses c where c.id = course_id and c.user_id = (select auth.uid()))
    and (quiz_id is null or exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = (select auth.uid()))));
grant select, insert, update, delete on public.learning_lessons to authenticated;

create table if not exists public.learning_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (course_id, user_id) references public.learning_courses(id, user_id) on delete cascade,
  unique (course_id, user_id)
);
create index if not exists learning_enrollments_owner_idx on public.learning_enrollments(user_id, started_at desc);
alter table public.learning_enrollments enable row level security;
drop policy if exists "Users manage own learning enrollments" on public.learning_enrollments;
create policy "Users manage own learning enrollments" on public.learning_enrollments
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.learning_courses c where c.id = course_id and c.user_id = (select auth.uid())));
grant select, insert, update, delete on public.learning_enrollments to authenticated;

create table if not exists public.learning_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null,
  course_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  last_opened_at timestamptz not null default now(),
  completed_at timestamptz,
  assessment_attempt_id uuid references public.quiz_attempts(id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (lesson_id, course_id, user_id) references public.learning_lessons(id, course_id, user_id) on delete cascade,
  unique (lesson_id, user_id),
  check ((status = 'completed' and completed_at is not null) or (status = 'in_progress' and completed_at is null))
);
create index if not exists learning_lesson_progress_owner_course_idx on public.learning_lesson_progress(user_id, course_id, status);
alter table public.learning_lesson_progress enable row level security;
drop policy if exists "Users manage own lesson progress" on public.learning_lesson_progress;
create policy "Users manage own lesson progress" on public.learning_lesson_progress
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.learning_lessons l where l.id = lesson_id and l.course_id = course_id and l.user_id = (select auth.uid()))
    and (assessment_attempt_id is null or exists (select 1 from public.quiz_attempts a where a.id = assessment_attempt_id and a.user_id = (select auth.uid()))));
grant select, insert, update, delete on public.learning_lesson_progress to authenticated;

create or replace function public.create_learning_course(p_title text, p_subject text, p_description text, p_source_note_id uuid, p_lessons jsonb)
returns table (id uuid, title text, lesson_count integer, created_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  course_id uuid;
  lesson jsonb;
  lesson_position integer := 0;
  assigned_quiz uuid;
  created timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then raise exception 'Course title must contain 1 through 160 characters'; end if;
  if char_length(coalesce(p_subject, '')) > 160 or char_length(coalesce(p_description, '')) > 2000 then raise exception 'Course metadata is too long'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons) <> 'array' then raise exception 'Lessons must be an array'; end if;
  if jsonb_array_length(p_lessons) not between 1 and 20 then raise exception 'A course needs between 1 and 20 lessons'; end if;
  if p_source_note_id is not null and not exists (select 1 from public.notes n where n.id = p_source_note_id and n.user_id = (select auth.uid())) then raise exception 'Source note is not available'; end if;
  insert into public.learning_courses(user_id, title, subject, description, source_note_id)
  values ((select auth.uid()), btrim(p_title), coalesce(btrim(p_subject), ''), coalesce(btrim(p_description), ''), p_source_note_id)
  returning learning_courses.id into course_id;
  for lesson in select value from jsonb_array_elements(p_lessons) loop
    if jsonb_typeof(lesson) <> 'object'
      or char_length(btrim(coalesce(lesson->>'title', ''))) not between 1 and 160
      or char_length(btrim(coalesce(lesson->>'objective', ''))) not between 1 and 500
      or char_length(btrim(coalesce(lesson->>'content', ''))) not between 1 and 8000
      or char_length(coalesce(lesson->>'quiz_id', '')) > 36 then
      raise exception 'A course lesson has invalid fields';
    end if;
    assigned_quiz := nullif(lesson->>'quiz_id', '')::uuid;
    if assigned_quiz is not null and not exists (select 1 from public.quizzes q where q.id = assigned_quiz and q.user_id = (select auth.uid())) then raise exception 'An assigned quiz is not available'; end if;
    insert into public.learning_lessons(course_id, user_id, title, objective, content, position, quiz_id)
    values (course_id, (select auth.uid()), btrim(lesson->>'title'), btrim(lesson->>'objective'), btrim(lesson->>'content'), lesson_position, assigned_quiz);
    lesson_position := lesson_position + 1;
  end loop;
  insert into public.learning_enrollments(course_id, user_id, started_at) values (course_id, (select auth.uid()), created);
  return query select c.id, c.title, lesson_position, created from public.learning_courses c where c.id = course_id;
end;
$$;
revoke all on function public.create_learning_course(text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_learning_course(text, text, text, uuid, jsonb) to authenticated;

create or replace function public.set_learning_lesson_progress(p_lesson_id uuid, p_status text)
returns table (id uuid, lesson_id uuid, course_id uuid, status text, completed_at timestamptz, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  lesson public.learning_lessons%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('in_progress', 'completed') then raise exception 'Invalid lesson status'; end if;
  select * into lesson from public.learning_lessons l where l.id = p_lesson_id and l.user_id = (select auth.uid());
  if not found then raise exception 'Lesson not found or access denied'; end if;
  return query insert into public.learning_lesson_progress as current_progress(lesson_id, course_id, user_id, status, last_opened_at, completed_at)
    values (lesson.id, lesson.course_id, (select auth.uid()), p_status, now(), case when p_status = 'completed' then now() else null end)
    on conflict (lesson_id, user_id) do update set status = excluded.status, last_opened_at = now(),
      completed_at = case when excluded.status = 'completed' then coalesce(current_progress.completed_at, now()) else null end,
      updated_at = now()
    returning current_progress.id, current_progress.lesson_id, current_progress.course_id,
      current_progress.status, current_progress.completed_at, current_progress.updated_at;
end;
$$;
revoke all on function public.set_learning_lesson_progress(uuid, text) from public, anon;
grant execute on function public.set_learning_lesson_progress(uuid, text) to authenticated;

alter table public.quiz_attempts add column if not exists learning_lesson_id uuid references public.learning_lessons(id) on delete set null;
create index if not exists quiz_attempts_learning_lesson_idx on public.quiz_attempts(user_id, learning_lesson_id, completed_at desc) where learning_lesson_id is not null;

create or replace function public.submit_learning_quiz_attempt(p_quiz_id uuid, p_lesson_id uuid, p_started_at timestamptz, p_answers jsonb)
returns table (id uuid, quiz_id uuid, learning_lesson_id uuid, correct_count integer, total_count integer, completed_at timestamptz, answers jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  attempt_id uuid;
  completed timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.learning_lessons l where l.id = p_lesson_id and l.user_id = (select auth.uid()) and l.quiz_id = p_quiz_id) then raise exception 'Lesson assessment is not available'; end if;
  if p_started_at is null or p_started_at > completed or p_started_at < completed - interval '1 day' then raise exception 'Quiz start time is invalid'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'Quiz answers must be an array'; end if;
  insert into public.quiz_attempts(quiz_id, user_id, learning_lesson_id, answers, correct_count, total_count, started_at, completed_at)
  values (p_quiz_id, (select auth.uid()), p_lesson_id, p_answers, 0, 1, p_started_at, completed)
  returning quiz_attempts.id into attempt_id;
  return query select a.id, a.quiz_id, a.learning_lesson_id, a.correct_count, a.total_count, a.completed_at, a.answers from public.quiz_attempts a where a.id = attempt_id;
end;
$$;
revoke all on function public.submit_learning_quiz_attempt(uuid, uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.submit_learning_quiz_attempt(uuid, uuid, timestamptz, jsonb) to authenticated;

create or replace function public.sync_learning_assessment_progress()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  lesson public.learning_lessons%rowtype;
  passed boolean;
begin
  if new.learning_lesson_id is null then return new; end if;
  select * into lesson from public.learning_lessons l where l.id = new.learning_lesson_id and l.user_id = new.user_id and l.quiz_id = new.quiz_id;
  if not found then raise exception 'Lesson assessment is not available'; end if;
  passed := floor(new.correct_count * 100.0 / new.total_count) >= lesson.pass_threshold;
  insert into public.learning_lesson_progress(lesson_id, course_id, user_id, status, last_opened_at, completed_at, assessment_attempt_id)
  values (lesson.id, lesson.course_id, new.user_id, case when passed then 'completed' else 'in_progress' end, new.completed_at,
    case when passed then new.completed_at else null end, new.id)
  on conflict (lesson_id, user_id) do update set last_opened_at = excluded.last_opened_at,
    assessment_attempt_id = excluded.assessment_attempt_id,
    status = case when excluded.status = 'completed' then 'completed' else public.learning_lesson_progress.status end,
    completed_at = case when excluded.status = 'completed' then coalesce(public.learning_lesson_progress.completed_at, excluded.completed_at) else public.learning_lesson_progress.completed_at end,
    updated_at = now();
  return new;
end;
$$;
drop trigger if exists quiz_attempts_sync_learning_progress on public.quiz_attempts;
create trigger quiz_attempts_sync_learning_progress after insert on public.quiz_attempts
for each row execute function public.sync_learning_assessment_progress();
revoke all on function public.sync_learning_assessment_progress() from public, anon, authenticated;
