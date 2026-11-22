-- Assert every advisor-reported workspace foreign key has a valid supporting index.
do $$
declare
  missing text;
begin
  with expected(table_name, index_name, columns) as (
    values
      ('eylo_file_versions', 'idx_eylo_file_versions_file_id_user_id', array['file_id','user_id']::text[]),
      ('eylo_files', 'idx_eylo_files_project_id', array['project_id']::text[]),
      ('learning_courses', 'idx_learning_courses_source_note_id', array['source_note_id']::text[]),
      ('learning_lesson_progress', 'idx_learning_lesson_progress_assessment_attempt_id', array['assessment_attempt_id']::text[]),
      ('learning_lesson_progress', 'idx_learning_lesson_progress_lesson_course_user', array['lesson_id','course_id','user_id']::text[]),
      ('learning_lessons', 'idx_learning_lessons_course_id_user_id', array['course_id','user_id']::text[]),
      ('learning_lessons', 'idx_learning_lessons_quiz_id', array['quiz_id']::text[]),
      ('quiz_attempts', 'idx_quiz_attempts_learning_lesson_id', array['learning_lesson_id']::text[]),
      ('quiz_attempts', 'idx_quiz_attempts_quiz_id_user_id', array['quiz_id','user_id']::text[]),
      ('quiz_questions', 'idx_quiz_questions_quiz_id_user_id', array['quiz_id','user_id']::text[]),
      ('quizzes', 'idx_quizzes_source_note_id', array['source_note_id']::text[]),
      ('time_entries', 'idx_time_entries_life_task_id', array['life_task_id']::text[]),
      ('time_entries', 'idx_time_entries_project_id', array['project_id']::text[])
  ),
  actual as (
    select tbl.relname as table_name, idx.relname as index_name,
           i.indisvalid, i.indisready,
           array_agg(att.attname order by key.ordinality) as columns
      from pg_index i
      join pg_class tbl on tbl.oid = i.indrelid
      join pg_namespace ns on ns.oid = tbl.relnamespace
      join pg_class idx on idx.oid = i.indexrelid
      cross join lateral unnest(i.indkey::smallint[]) with ordinality as key(attnum, ordinality)
      join pg_attribute att on att.attrelid = tbl.oid and att.attnum = key.attnum
     where ns.nspname = 'public' and key.ordinality <= i.indnkeyatts
     group by tbl.relname, idx.relname, i.indisvalid, i.indisready, i.indnkeyatts
  )
  select string_agg(e.table_name || '.' || e.index_name, ', ')
    into missing
    from expected e
   where not exists (
     select 1 from actual a
      where a.table_name = e.table_name
        and a.index_name = e.index_name
        and a.columns = e.columns
        and a.indisvalid and a.indisready
   );
  if missing is not null then
    raise exception 'Missing or invalid foreign-key indexes: %', missing;
  end if;
end
$$;
