-- Cover the 13 foreign keys identified by the read-only production advisor.
-- These indexes improve referenced-row delete/update checks and owner-scoped
-- joins; they are additive and retain all existing indexes.
create index if not exists eylo_file_versions_parent_owner_fk_idx
  on public.eylo_file_versions (file_id, user_id);
create index if not exists eylo_files_project_fk_idx
  on public.eylo_files (project_id);
create index if not exists learning_courses_source_note_fk_idx
  on public.learning_courses (source_note_id);
create index if not exists learning_progress_assessment_fk_idx
  on public.learning_lesson_progress (assessment_attempt_id);
create index if not exists learning_progress_lesson_course_user_fk_idx
  on public.learning_lesson_progress (lesson_id, course_id, user_id);
create index if not exists learning_lessons_course_user_fk_idx
  on public.learning_lessons (course_id, user_id);
create index if not exists learning_lessons_quiz_fk_idx
  on public.learning_lessons (quiz_id);
create index if not exists quiz_attempts_learning_lesson_fk_idx
  on public.quiz_attempts (learning_lesson_id);
create index if not exists quiz_attempts_quiz_user_fk_idx
  on public.quiz_attempts (quiz_id, user_id);
create index if not exists quiz_questions_quiz_user_fk_idx
  on public.quiz_questions (quiz_id, user_id);
create index if not exists quizzes_source_note_fk_idx
  on public.quizzes (source_note_id);
create index if not exists time_entries_life_task_fk_idx
  on public.time_entries (life_task_id);
create index if not exists time_entries_project_fk_idx
  on public.time_entries (project_id);
