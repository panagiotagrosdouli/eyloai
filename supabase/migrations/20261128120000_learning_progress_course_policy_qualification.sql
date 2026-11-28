-- Forward-only correction: qualify the outer row's course_id in the
-- learning_lesson_progress policy. The historical unqualified reference
-- resolves to learning_lessons.course_id inside the subquery, making that
-- predicate tautological. The validated composite FK remains an independent
-- integrity boundary and is not modified here.
drop policy if exists "Users manage own lesson progress" on public.learning_lesson_progress;

create policy "Users manage own lesson progress" on public.learning_lesson_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (
      select 1
      from public.learning_lessons l
      where l.id = public.learning_lesson_progress.lesson_id
        and l.course_id = public.learning_lesson_progress.course_id
        and l.user_id = (select auth.uid())
    )
    and (assessment_attempt_id is null or exists (
      select 1
      from public.quiz_attempts a
      where a.id = public.learning_lesson_progress.assessment_attempt_id
        and a.user_id = (select auth.uid())
    )));
