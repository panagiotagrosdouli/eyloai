create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  subject text not null default '' check (char_length(subject) <= 160),
  source_note_id uuid references public.notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1 check (revision >= 1),
  unique (id, user_id)
);
create index if not exists quizzes_owner_updated_idx on public.quizzes(user_id, updated_at desc);
alter table public.quizzes enable row level security;
drop policy if exists "Users manage own quizzes" on public.quizzes;
create policy "Users manage own quizzes" on public.quizzes
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (source_note_id is null or exists (select 1 from public.notes n where n.id = source_note_id and n.user_id = (select auth.uid()))));
grant select, insert, update, delete on public.quizzes to authenticated;

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 2000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text not null default '' check (char_length(explanation) <= 2000),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (quiz_id, user_id) references public.quizzes(id, user_id) on delete cascade,
  unique (quiz_id, position),
  unique (id, quiz_id, user_id)
);
create index if not exists quiz_questions_user_quiz_idx on public.quiz_questions(user_id, quiz_id, position);
alter table public.quiz_questions enable row level security;
drop policy if exists "Users manage own quiz questions" on public.quiz_questions;
create policy "Users manage own quiz questions" on public.quiz_questions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = (select auth.uid())));
grant select, insert, update, delete on public.quiz_questions to authenticated;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  correct_count integer not null check (correct_count >= 0),
  total_count integer not null check (total_count > 0 and correct_count <= total_count),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  foreign key (quiz_id, user_id) references public.quizzes(id, user_id) on delete cascade
);
create index if not exists quiz_attempts_user_quiz_idx on public.quiz_attempts(user_id, quiz_id, completed_at desc);
alter table public.quiz_attempts enable row level security;
drop policy if exists "Users read own quiz attempts" on public.quiz_attempts;
create policy "Users read own quiz attempts" on public.quiz_attempts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users save own quiz attempts" on public.quiz_attempts;
create policy "Users save own quiz attempts" on public.quiz_attempts
  for insert to authenticated with check ((select auth.uid()) = user_id
    and exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = (select auth.uid())));
grant select, insert on public.quiz_attempts to authenticated;

create or replace function public.touch_quiz_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;
drop trigger if exists quizzes_touch_updated_at on public.quizzes;
create trigger quizzes_touch_updated_at before update on public.quizzes
for each row execute function public.touch_quiz_updated_at();
revoke all on function public.touch_quiz_updated_at() from public, anon, authenticated;

create or replace function public.create_quiz(p_title text, p_subject text, p_source_note_id uuid, p_questions jsonb)
returns table (id uuid, title text, question_count integer, created_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  new_quiz_id uuid;
  item jsonb;
  option_item jsonb;
  option_text text;
  option_values text[];
  item_position integer := 0;
  option_count integer;
  inserted_at timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then raise exception 'Quiz title must contain 1 through 160 characters'; end if;
  if coalesce(p_subject, '') <> '' and char_length(p_subject) > 160 then raise exception 'Subject is too long'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then raise exception 'Quiz questions must be an array'; end if;
  if jsonb_array_length(p_questions) not between 3 and 20 then raise exception 'A quiz needs between 3 and 20 questions'; end if;
  if p_source_note_id is not null and not exists (select 1 from public.notes n where n.id = p_source_note_id and n.user_id = (select auth.uid())) then raise exception 'Source note is not available'; end if;
  insert into public.quizzes(user_id, title, subject, source_note_id)
    values ((select auth.uid()), btrim(p_title), coalesce(btrim(p_subject), ''), p_source_note_id)
    returning quizzes.id into new_quiz_id;
  for item in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'A generated question must be an object'; end if;
    if char_length(btrim(coalesce(item->>'prompt', ''))) not between 1 and 2000
      or char_length(btrim(coalesce(item->>'explanation', ''))) not between 1 and 2000
      or jsonb_typeof(item->'options') <> 'array'
      or coalesce(item->>'correct_index', '') !~ '^[0-3]$' then
      raise exception 'A generated question has invalid fields';
    end if;
    if jsonb_array_length(item->'options') <> 4 then raise exception 'Each question needs four options'; end if;
    option_count := 0;
    option_values := array[]::text[];
    for option_item in select value from jsonb_array_elements(item->'options') loop
      option_text := btrim(option_item #>> '{}');
      if jsonb_typeof(option_item) <> 'string' or char_length(option_text) not between 1 and 500 then raise exception 'Question options must be non-empty text'; end if;
      if lower(option_text) = any(option_values) then raise exception 'Question options must be distinct'; end if;
      option_values := array_append(option_values, lower(option_text));
      option_count := option_count + 1;
    end loop;
    if option_count <> 4 then raise exception 'Each question needs four options'; end if;
    insert into public.quiz_questions(quiz_id, user_id, prompt, options, correct_index, explanation, position)
    values (new_quiz_id, (select auth.uid()), btrim(item->>'prompt'), item->'options', (item->>'correct_index')::smallint, coalesce(item->>'explanation', ''), item_position);
    item_position := item_position + 1;
  end loop;
  return query select q.id, q.title, item_position, inserted_at from public.quizzes q where q.id = new_quiz_id;
end;
$$;
revoke all on function public.create_quiz(text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_quiz(text, text, uuid, jsonb) to authenticated;

create or replace function public.grade_quiz_attempt()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  question record;
  answer jsonb;
  selected smallint;
  seen integer := 0;
  score integer := 0;
  total integer := 0;
  graded jsonb := '[]'::jsonb;
  completion_time timestamptz := now();
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then raise exception 'Authentication required'; end if;
  if new.started_at is null or new.started_at > completion_time or new.started_at < completion_time - interval '1 day' then raise exception 'Quiz start time is invalid'; end if;
  if new.answers is null or jsonb_typeof(new.answers) <> 'array' then raise exception 'Quiz answers must be an array'; end if;
  if not exists (select 1 from public.quizzes q where q.id = new.quiz_id and q.user_id = (select auth.uid())) then raise exception 'Quiz not found or access denied'; end if;
  for question in select qq.id, qq.correct_index, qq.options from public.quiz_questions qq where qq.quiz_id = new.quiz_id and qq.user_id = (select auth.uid()) order by qq.position loop
    total := total + 1;
    select value into answer from jsonb_array_elements(new.answers) where value->>'question_id' = question.id::text;
    if answer is null or coalesce(answer->>'selected_index', '') !~ '^[0-3]$' then raise exception 'Every question must have one selected answer'; end if;
    selected := (answer->>'selected_index')::smallint;
    if selected >= jsonb_array_length(question.options) then raise exception 'Selected answer is invalid'; end if;
    seen := seen + 1;
    if selected = question.correct_index then score := score + 1; end if;
    graded := graded || jsonb_build_array(jsonb_build_object('question_id', question.id, 'selected_index', selected, 'is_correct', selected = question.correct_index));
  end loop;
  if total < 3 or seen <> total or jsonb_array_length(new.answers) <> total then raise exception 'Quiz answer set is incomplete or contains duplicate/unknown questions'; end if;
  new.answers := graded;
  new.correct_count := score;
  new.total_count := total;
  new.completed_at := completion_time;
  return new;
end;
$$;
drop trigger if exists quiz_attempts_grade_before_insert on public.quiz_attempts;
create trigger quiz_attempts_grade_before_insert before insert on public.quiz_attempts
for each row execute function public.grade_quiz_attempt();
revoke all on function public.grade_quiz_attempt() from public, anon, authenticated;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_started_at timestamptz, p_answers jsonb)
returns table (id uuid, quiz_id uuid, correct_count integer, total_count integer, completed_at timestamptz, answers jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  item record;
  submitted jsonb;
  submitted_index integer;
  matched integer := 0;
  correct_total integer := 0;
  question_total integer := 0;
  clean_answers jsonb := '[]'::jsonb;
  attempt_id uuid;
  completed timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_started_at is null or p_started_at > completed or p_started_at < completed - interval '1 day' then raise exception 'Quiz start time is invalid'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'Quiz answers must be an array'; end if;
  if not exists (select 1 from public.quizzes q where q.id = p_quiz_id and q.user_id = (select auth.uid())) then raise exception 'Quiz not found or access denied'; end if;
  for item in select qq.id, qq.correct_index, qq.options from public.quiz_questions qq where qq.quiz_id = p_quiz_id and qq.user_id = (select auth.uid()) order by qq.position loop
    question_total := question_total + 1;
    select value into submitted from jsonb_array_elements(p_answers) where value->>'question_id' = item.id::text;
    if submitted is null or (submitted->>'selected_index') !~ '^[0-3]$' then raise exception 'Every question must have one selected answer'; end if;
    submitted_index := (submitted->>'selected_index')::integer;
    if submitted_index >= jsonb_array_length(item.options) then raise exception 'Selected answer is invalid'; end if;
    matched := matched + 1;
    if submitted_index = item.correct_index then correct_total := correct_total + 1; end if;
    clean_answers := clean_answers || jsonb_build_array(jsonb_build_object('question_id', item.id, 'selected_index', submitted_index, 'is_correct', submitted_index = item.correct_index));
  end loop;
  if question_total < 3 or matched <> question_total or jsonb_array_length(p_answers) <> question_total then raise exception 'Quiz answer set is incomplete or contains duplicate/unknown questions'; end if;
  insert into public.quiz_attempts(quiz_id, user_id, answers, correct_count, total_count, started_at, completed_at)
  values (p_quiz_id, (select auth.uid()), clean_answers, correct_total, question_total, p_started_at, completed)
  returning quiz_attempts.id into attempt_id;
  return query select a.id, a.quiz_id, a.correct_count, a.total_count, a.completed_at, a.answers from public.quiz_attempts a where a.id = attempt_id;
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, timestamptz, jsonb) to authenticated;
