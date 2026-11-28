-- Project deletion normally clears its optional association from flashcard
-- decks. During an Auth-user cascade, however, the Auth role is intentionally
-- granted DELETE only; trying to update the child deck blocks account removal.
-- Keep the user-facing unlink behavior, but run it only for the authenticated
-- owner deleting their own project through the application.
-- CREATE OR REPLACE preserves the revoked function ACL established by the
-- original migration; keep this as one SQL statement for CLI acceptance.
create or replace function private.unlink_deleted_project_flashcard_decks()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated'
     or (select auth.uid()) is distinct from old.user_id then
    return old;
  end if;

  update public.study_flashcard_decks d
  set data = (d.data - 'project_title') || jsonb_build_object('project_id', null)
  where d.user_id = old.user_id and d.data ->> 'project_id' = old.id::text;
  return old;
end;
$$;
