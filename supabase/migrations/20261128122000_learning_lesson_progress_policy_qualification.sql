-- Forward-only correction for the ambiguous course_id reference in the
-- learning_lesson_progress WITH CHECK policy. The composite foreign key remains
-- the final integrity boundary; this policy now states the same relationship
-- explicitly for each owner-authenticated write.
drop policy if exists "Users manage own lesson progress" on public.learning_lesson_progress;
create policy "Users manage own lesson progress" on public.learning_lesson_progress
  for all to authenticated
  using ((select auth.uid()) = learning_lesson_progress.user_id)
  with check ((select auth.uid()) = learning_lesson_progress.user_id
    and exists (
      select 1
      from public.learning_lessons l
      where l.id = learning_lesson_progress.lesson_id
        and l.course_id = learning_lesson_progress.course_id
        and l.user_id = (select auth.uid())
    )
    and (learning_lesson_progress.assessment_attempt_id is null
      or exists (
        select 1
        from public.quiz_attempts a
        where a.id = learning_lesson_progress.assessment_attempt_id
          and a.user_id = (select auth.uid())
      )
    )
  );
