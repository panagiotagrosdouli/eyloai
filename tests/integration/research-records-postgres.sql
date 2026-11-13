-- Exercise canonical project JSON persistence and RLS. Domain validation is client-side;
-- these records share the existing project security boundary, not a new database/table.
create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Research assertion failed: %', message; end if; end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into projects (id, user_id, data) values ('10000000-0000-4000-8000-000000000777', auth.uid(), '{"title":"Research records fixture","unrelated":"preserve","research_journal":[{"version":1,"id":"a0000000-0000-4000-8000-000000000001","title":"Observation","date":"2026-11-13","due_date":"","status":"recorded","observation":"Observed signal","interpretation":"Uncertain","next_step":"Repeat","source_url":""}],"experiment_records":[{"version":1,"id":"a0000000-0000-4000-8000-000000000002","title":"Experiment","date":"2026-11-13","due_date":"","status":"planned","hypothesis":"Test signal","method":"Compare measures","result":"","limitations":"","source_url":""}],"publication_records":[{"version":1,"id":"a0000000-0000-4000-8000-000000000003","title":"Manuscript","date":"2026-11-13","due_date":"2026-12-01","status":"submitted","venue":"User venue","reference":"USER-REF","next_step":"Review","notes":"","source_url":""}]}');
select pg_temp.assert((select data->'research_journal'->0->>'observation' = 'Observed signal' and data->'experiment_records'->0->>'hypothesis' = 'Test signal' and data->'publication_records'->0->>'reference' = 'USER-REF' from projects where id='10000000-0000-4000-8000-000000000777'), 'three canonical research collections roundtrip');
-- Separate insert and update transactions exercise the existing timestamp CAS trigger.
do $$ declare old_version timestamptz; n int; begin
 select updated_date into old_version from projects where id='10000000-0000-4000-8000-000000000777';
 update projects set data=jsonb_set(data, '{research_journal,0,interpretation}', '"Review needed"') where id='10000000-0000-4000-8000-000000000777' and user_id=auth.uid() and updated_date=old_version;
 get diagnostics n = row_count;
 if n != 1 then raise exception 'Owner CAS write failed'; end if;
 update projects set data=data||'{"stale_writer":"must not persist"}' where id='10000000-0000-4000-8000-000000000777' and user_id=auth.uid() and updated_date=old_version;
 get diagnostics n = row_count;
 if n != 0 then raise exception 'Stale research CAS update was accepted'; end if;
end $$;
select pg_temp.assert((select data->>'unrelated' = 'preserve' and jsonb_array_length(data->'experiment_records')=1 and jsonb_array_length(data->'publication_records')=1 and not(data ? 'stale_writer') from projects where id='10000000-0000-4000-8000-000000000777'), 'research edit preserves other collections');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert((select count(*)=0 from projects where id='10000000-0000-4000-8000-000000000777'), 'outsider cannot read research collections');
do $$ declare n int; begin
 update projects set data='{}' where id='10000000-0000-4000-8000-000000000777'; get diagnostics n=row_count;
 if n != 0 then raise exception 'Outsider changed research collections'; end if;
 delete from projects where id='10000000-0000-4000-8000-000000000777'; get diagnostics n=row_count;
 if n != 0 then raise exception 'Outsider deleted research project'; end if;
end $$;
reset role;
delete from projects where id='10000000-0000-4000-8000-000000000777';
