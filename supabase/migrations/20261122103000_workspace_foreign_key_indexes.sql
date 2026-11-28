-- Add indexes for foreign-key columns flagged by the Supabase performance advisor.
-- Additive and idempotent; inclusion in the local replay manifest does not authorize
-- applying this migration to a hosted database.
create index if not exists idx_eylo_file_versions_file_id_user_id
  on public.eylo_file_versions (file_id, user_id);
create index if not exists idx_eylo_files_project_id
  on public.eylo_files (project_id);
create index if not exists idx_learning_courses_source_note_id
  on public.learning_courses (source_note_id);
create index if not exists idx_learning_lesson_progress_assessment_attempt_id
  on public.learning_lesson_progress (assessment_attempt_id);
create index if not exists idx_learning_lesson_progress_lesson_course_user
  on public.learning_lesson_progress (lesson_id, course_id, user_id);
create index if not exists idx_learning_lessons_course_id_user_id
  on public.learning_lessons (course_id, user_id);
create index if not exists idx_learning_lessons_quiz_id
  on public.learning_lessons (quiz_id);
create index if not exists idx_quiz_attempts_learning_lesson_id
  on public.quiz_attempts (learning_lesson_id);
create index if not exists idx_quiz_attempts_quiz_id_user_id
  on public.quiz_attempts (quiz_id, user_id);
create index if not exists idx_quiz_questions_quiz_id_user_id
  on public.quiz_questions (quiz_id, user_id);
create index if not exists idx_quizzes_source_note_id
  on public.quizzes (source_note_id);
create index if not exists idx_time_entries_life_task_id
  on public.time_entries (life_task_id);
create index if not exists idx_time_entries_project_id
  on public.time_entries (project_id);
