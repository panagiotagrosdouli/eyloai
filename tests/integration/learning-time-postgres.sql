-- Execute actual timer, quiz grading and course RPCs against the canonical workspace.
create function pg_temp.check_learning(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Learning assertion failed: %', message; end if; end $$;
create temporary table learning_progress_test_fixture (key text primary key, id uuid not null);
do $$ declare temp_schema name; begin
  select nspname into temp_schema from pg_namespace where oid = pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated, anon', temp_schema);
end $$;
grant select, insert on pg_temp.learning_progress_test_fixture to authenticated, anon;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ declare check_expression text; begin
  select pg_get_expr(p.polwithcheck, p.polrelid)
    into check_expression
    from pg_policy p
   where p.polname = 'Users manage own lesson progress'
     and p.polrelid = 'public.learning_lesson_progress'::regclass;
  perform pg_temp.check_learning(
    check_expression is not null
      and check_expression ~ 'l[.]course_id = learning_lesson_progress[.]course_id'
      and check_expression !~ 'l[.]course_id = l[.]course_id',
    'lesson progress write policy explicitly compares lesson and progress course IDs'
  );
end $$;
insert into time_entries (user_id, description, project_id, life_task_id, started_at)
values (auth.uid(), 'Canonical task timer', '10000000-0000-0000-0000-000000000001', (select id from life_tasks limit 1), now() - interval '1 hour');
do $$ begin
  begin
    insert into time_entries (user_id, description, started_at) values (auth.uid(), 'Duplicate timer', now());
    raise exception 'Second active timer unexpectedly succeeded';
  exception when unique_violation then null; end;
end $$;
update time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
select pg_temp.check_learning((select count(*) = 1 from time_entries where ended_at is not null and life_task_id is not null), 'timer links to canonical life_tasks');

do $$ declare quiz uuid; course uuid; other_course uuid; lesson uuid; attempt record; answer_set jsonb; begin
  select id into quiz from create_quiz('Canonical quiz', 'Methods', '30000000-0000-0000-0000-000000000001',
    '[{"prompt":"Question one", "options":["A","B","C","D"], "correct_index":0,"explanation":"Source one"},
      {"prompt":"Question two", "options":["A","B","C","D"], "correct_index":1,"explanation":"Source two"},
      {"prompt":"Question three", "options":["A","B","C","D"], "correct_index":2,"explanation":"Source three"}]');
  perform pg_temp.check_learning((select count(*) = 3 from quiz_questions where quiz_id = quiz), 'quiz and questions saved atomically');
  select jsonb_agg(jsonb_build_object('question_id', q.id, 'selected_index', q.correct_index, 'is_correct', false)) into answer_set from quiz_questions q where q.quiz_id = quiz;
  select * into attempt from submit_quiz_attempt(quiz, now() - interval '1 minute', answer_set);
  perform pg_temp.check_learning(attempt.correct_count = 3 and attempt.total_count = 3, 'database computes grade, ignoring client correctness');
  select id into course from create_learning_course('Canonical course', 'Methods', 'User-authored lessons', '30000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('title','Review evidence','objective','Compare the supplied evidence','content','Read the supplied methods and record their limitations before drawing a conclusion.','quiz_id',quiz)));
  select id into lesson from learning_lessons where course_id = course;
  select id into other_course from create_learning_course('Other owner course', 'Methods', 'Second course for relationship checks', null,
    jsonb_build_array(jsonb_build_object('title','Separate evidence','objective','Keep course links exact','content','This lesson belongs to a distinct course.')));
  insert into pg_temp.learning_progress_test_fixture values
    ('owner_course', course), ('owner_lesson', lesson), ('other_course', other_course);
  perform set_learning_lesson_progress(lesson, 'in_progress');
  perform submit_learning_quiz_attempt(quiz, lesson, now() - interval '1 minute', answer_set);
  perform pg_temp.check_learning((select status = 'completed' and assessment_attempt_id is not null from learning_lesson_progress where lesson_id = lesson), 'passing saved quiz updates lesson progress');
  begin
    insert into learning_lesson_progress (lesson_id, course_id, user_id, status)
    values (lesson, other_course, auth.uid(), 'in_progress');
    raise exception 'RLS accepted a lesson paired with a different valid course';
  exception
    when insufficient_privilege then null;
    when foreign_key_violation then raise exception 'RLS failed to reject a mismatched course before the composite foreign key';
  end;
  begin
    insert into learning_lesson_progress (lesson_id, course_id, user_id, status)
    values (lesson, course, '00000000-0000-0000-0000-000000000002', 'in_progress');
    raise exception 'RLS accepted forged progress ownership';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare t text; n bigint; begin
  foreach t in array array['ideas','time_entries','quizzes','quiz_questions','quiz_attempts','learning_courses','learning_lessons','learning_enrollments','learning_lesson_progress'] loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.check_learning(n = 0, 'outsider cannot read ' || t);
  end loop;
  begin
    insert into time_entries (user_id, description, project_id, started_at) values (auth.uid(), 'Cross-owner project', '10000000-0000-0000-0000-000000000001', now());
    raise exception 'Cross-owner timer link unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into learning_lesson_progress (lesson_id, course_id, user_id, status)
    select (select id from pg_temp.learning_progress_test_fixture where key='owner_lesson'),
           (select id from pg_temp.learning_progress_test_fixture where key='owner_course'), auth.uid(), 'in_progress';
    raise exception 'Cross-account lesson progress insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  update learning_lesson_progress set status='in_progress', completed_at=null
    where lesson_id=(select id from pg_temp.learning_progress_test_fixture where key='owner_lesson');
  get diagnostics n = row_count;
  perform pg_temp.check_learning(n = 0, 'outsider cannot update another owner lesson progress');
  delete from learning_lesson_progress
    where lesson_id=(select id from pg_temp.learning_progress_test_fixture where key='owner_lesson');
  get diagnostics n = row_count;
  perform pg_temp.check_learning(n = 0, 'outsider cannot delete another owner lesson progress');
end $$;
reset role;

set role anon;
do $$ declare n bigint; begin
  begin
    select count(*) into n from public.learning_lesson_progress;
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'Anonymous role read lesson progress'; end if;
  begin
    insert into public.learning_lesson_progress (lesson_id, course_id, user_id, status)
    select (select id from pg_temp.learning_progress_test_fixture where key='owner_lesson'),
           (select id from pg_temp.learning_progress_test_fixture where key='owner_course'), auth.uid(), 'in_progress';
    raise exception 'Anonymous role inserted lesson progress';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
