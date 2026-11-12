-- Disposable local identities only. These are PostgreSQL role tests, not live accounts.
create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end $$;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into projects (id, user_id, data) values ('10000000-0000-0000-0000-000000000001', auth.uid(), '{"title":"Alpha project", "plan_items":[], "decision_records":[]}');
insert into notes (id, user_id, data) values ('30000000-0000-0000-0000-000000000001', auth.uid(), '{"title":"Alpha note", "content":"Private evidence", "project_id":"10000000-0000-0000-0000-000000000001"}');
update notes set data = data || '{"content":"Revised private evidence"}' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) = 1 from note_versions where version = 1 and snapshot->>'content' = 'Private evidence'), 'database-backed previous note version');
select pg_temp.assert((select version = 2 from notes), 'current note version advances');
insert into life_tasks (user_id, data) values (auth.uid(), '{"title":"Alpha task"}');
insert into life_goals (user_id, data) values (auth.uid(), '{"title":"Alpha goal"}');
insert into study_flashcard_decks (user_id, data) values (auth.uid(), '{"title":"Alpha deck", "cards":[]}');
insert into calendar_events (user_id, data) values (auth.uid(), '{"title":"Alpha event", "start_at":"2026-12-01T10:00:00Z", "end_at":"2026-12-01T11:00:00Z"}');
insert into eylo_files (id, user_id, project_id, name, mime_type, size_bytes) values
  ('20000000-0000-0000-0000-000000000001', auth.uid(), '10000000-0000-0000-0000-000000000001', 'Alpha protocol.md', 'text/markdown', 12);
insert into eylo_file_versions (file_id, user_id, version_number, storage_path, mime_type, size_bytes) values
  ('20000000-0000-0000-0000-000000000001', auth.uid(), 1, '00000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/v1.md', 'text/markdown', 12);
insert into storage.objects (bucket_id, name) values ('eylo-files', '00000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/v1.md');
select pg_temp.assert((search_private_files('Alpha', 1, 20)->>'total')::int = 1, 'owner file search');
select pg_temp.assert((search_workspace_records('Note', 'Alpha', 1, 20)->>'total')::int = 1, 'owner note search');
select pg_temp.assert((select count(*) >= 6 from activity_events), 'transactional activity history');

-- The same authenticated database role with a different JWT identity sees no A records.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare t text; n bigint; begin
  foreach t in array array['projects','notes','note_versions','life_tasks','life_goals','study_flashcard_decks','calendar_events','activity_events','eylo_files','eylo_file_versions'] loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.assert(n = 0, 'cross-account select denied: ' || t);
  end loop;
end $$;
select pg_temp.assert((select count(*) = 0 from storage.objects), 'cross-account object metadata hidden');
select pg_temp.assert((search_private_files('Alpha', 1, 20)->>'total')::int = 0, 'cross-account file search');
select pg_temp.assert((search_workspace_records('Note', 'Alpha', 1, 20)->>'total')::int = 0, 'cross-account note search');
with changed as (update projects set data = '{"title":"Attacker"}' where id = '10000000-0000-0000-0000-000000000001' returning *)
select pg_temp.assert((select count(*) = 0 from changed), 'cross-account project update denied');
with removed as (delete from eylo_files where id = '20000000-0000-0000-0000-000000000001' returning *)
select pg_temp.assert((select count(*) = 0 from removed), 'cross-account file deletion denied');
do $$ begin
  begin
    insert into eylo_files (user_id, project_id, name, mime_type, size_bytes) values
      (auth.uid(), '10000000-0000-0000-0000-000000000001', 'Unauthorized association', 'text/plain', 1);
    raise exception 'Cross-owner file/project association unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into eylo_file_versions (file_id, user_id, version_number, storage_path, mime_type, size_bytes) values
      ('20000000-0000-0000-0000-000000000001', auth.uid(), 2, 'forged', 'text/plain', 1);
    raise exception 'Cross-owner file version unexpectedly succeeded';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('eylo-files', '00000000-0000-0000-0000-000000000001/forged');
    raise exception 'Cross-owner Storage upload unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert((select data->>'title' = 'Alpha project' from projects), 'owner project unchanged');
select pg_temp.assert((select count(*) = 1 from eylo_files), 'owner file retained');
-- A successful CAS changes exactly one row; reusing its old version changes zero rows.
do $$ declare old_version timestamptz; n int; begin
  select updated_date into old_version from projects where id = '10000000-0000-0000-0000-000000000001';
  update projects set data = data || '{"plan_items":[{"id":"task-1","title":"Review evidence"}]}'
    where id = '10000000-0000-0000-0000-000000000001' and updated_date = old_version;
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 1, 'first compare-and-set saves');
  update projects set data = data || '{"plan_items":[]}'
    where id = '10000000-0000-0000-0000-000000000001' and updated_date = old_version;
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'stale compare-and-set denied');
end $$;
reset role;
