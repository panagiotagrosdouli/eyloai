-- Canonical Project JSON documents and linked Note visibility; no new schema.
create function pg_temp.assert_planning(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Planning assertion failed: %', message; end if; end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into projects(id,user_id,data) values('10000000-0000-4000-8000-000000000888',auth.uid(),'{"title":"Planning fixture","preserve":"other workspace","research_budget":{"version":1,"currency":"EUR","allocation":"1.00","lines":[{"id":"a0000000-0000-4000-8000-000000000001","title":"Travel","category":"travel","planned":"0.10","actual":"0.20","status":"paid","notes":"fixture"}]},"thesis_outline":{"version":1,"title":"Thesis fixture","chapters":[{"id":"a0000000-0000-4000-8000-000000000002","title":"Introduction","target_words":100,"status":"writing","note_id":"30000000-0000-0000-0000-000000000001","guidance":"User authored"}]}}');
select pg_temp.assert_planning((select data->'research_budget'->'lines'->0->>'actual'='0.20' and data->'thesis_outline'->'chapters'->0->>'note_id'='30000000-0000-0000-0000-000000000001' from projects where id='10000000-0000-4000-8000-000000000888'),'budget decimals and canonical chapter link roundtrip');
select pg_temp.assert_planning((select count(*)=1 from notes where id='30000000-0000-0000-0000-000000000001'),'owner can resolve linked canonical note');
do $$ declare baseline timestamptz; n int; begin
 select updated_date into baseline from projects where id='10000000-0000-4000-8000-000000000888';
 update projects set data=jsonb_set(data,'{research_budget,allocation}','"2.00"') where id='10000000-0000-4000-8000-000000000888' and user_id=auth.uid() and updated_date=baseline;
 get diagnostics n=row_count; if n!=1 then raise exception 'Planning CAS save failed'; end if;
 update projects set data=jsonb_set(data,'{thesis_outline,title}','"Stale change"') where id='10000000-0000-4000-8000-000000000888' and user_id=auth.uid() and updated_date=baseline;
 get diagnostics n=row_count; if n!=0 then raise exception 'Stale planning save accepted'; end if;
end $$;
select pg_temp.assert_planning((select data->>'preserve'='other workspace' and data->'thesis_outline'->>'title'='Thesis fixture' from projects where id='10000000-0000-4000-8000-000000000888'),'budget save preserves thesis and unrelated data');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select pg_temp.assert_planning((select count(*)=0 from projects where id='10000000-0000-4000-8000-000000000888'),'outsider cannot read either planning document');
select pg_temp.assert_planning((select count(*)=0 from notes where id='30000000-0000-0000-0000-000000000001'),'outsider cannot resolve linked private note');
do $$ declare n int; begin
 update projects set data='{}' where id='10000000-0000-4000-8000-000000000888';get diagnostics n=row_count;if n!=0 then raise exception 'Outsider planning update accepted';end if;
 delete from projects where id='10000000-0000-4000-8000-000000000888';get diagnostics n=row_count;if n!=0 then raise exception 'Outsider planning delete accepted';end if;
end $$;
reset role;
delete from projects where id='10000000-0000-4000-8000-000000000888';
