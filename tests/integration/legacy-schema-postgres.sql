create function pg_temp.verify_legacy(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Legacy schema assertion failed: %',message;end if;end;$$;
select pg_temp.verify_legacy((select data->>'title'='Retained project' and data->'unknown_extension'='{"keep":true}' and created_at='2020-01-01T00:00:00Z' and updated_at='2020-02-01T00:00:00Z' and created_date=created_at and updated_date=updated_at from projects where id='91000000-0000-4000-8000-000000000001'),'old content and timestamps survive backfill');
select pg_temp.verify_legacy((select data->>'full_name'='Retained profile' and id=user_id and updated_at='2020-02-01T00:00:00Z' from profiles where id='90000000-0000-4000-8000-000000000001'),'profile ownership and metadata retained');
select pg_temp.verify_legacy((select tgenabled='A' from pg_trigger where tgrelid='public.projects'::regclass and tgname='legacy_always_timestamp'),'original trigger enable state restored');
set role authenticated;
set request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';
update projects set title='Legacy client edit' where id='91000000-0000-4000-8000-000000000001';
select pg_temp.verify_legacy((select data->>'title'='Legacy client edit' from projects where id='91000000-0000-4000-8000-000000000001'),'legacy column edits synchronize JSON');
update projects set data=data||'{"title":"Canonical edit","milestones":[{"title":"Keep structured values"}],"id":"forged","user_id":"forged"}' where id='91000000-0000-4000-8000-000000000001';
select pg_temp.verify_legacy((select title='Canonical edit' and jsonb_typeof(data->'milestones')='array' and user_id=auth.uid() from projects where id='91000000-0000-4000-8000-000000000001'),'canonical writes preserve structured JSON and identity');
insert into profiles(user_id,data) values(auth.uid(),'{"full_name":"Canonical profile"}') on conflict(user_id) do update set data=excluded.data;
select pg_temp.verify_legacy((select full_name='Canonical profile' and id=user_id from profiles where user_id=auth.uid()),'canonical profile upsert works with legacy primary key');
insert into projects(user_id,data) values(auth.uid(),'{"title":"New canonical project"}');
insert into ideas(user_id,data) values(auth.uid(),'{"title":"New canonical idea"}');
insert into meetings(user_id,data) values(auth.uid(),'{"title":"New canonical meeting","participants":["A"]}');
insert into saved_papers(user_id,data) values(auth.uid(),'{"title":"New canonical paper","authors":["A","B"]}');
insert into saved_researchers(user_id,data) values(auth.uid(),'{"name":"New canonical researcher"}');
insert into saved_opportunities(user_id,data) values(auth.uid(),'{"title":"New canonical opportunity"}');
insert into search_history(user_id,data) values(auth.uid(),'{"query":"Real query"}');
set request.jwt.claim.sub='90000000-0000-4000-8000-000000000002';
select pg_temp.verify_legacy((select count(*)=0 from projects),'legacy ownership policy still denies outsiders');
do $$ begin
 begin insert into profiles(user_id,data) values(auth.uid(),'{"full_name":"Second account"}'); exception when others then raise exception 'New profile failed: %',sqlerrm;end;
 begin insert into projects(user_id,data) values('90000000-0000-4000-8000-000000000001','{"title":"Cross-owner"}');raise exception 'Foreign insert accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Fixture cleanup only, before the ordinary two-account canonical regression suite.
delete from auth.users where id in('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002');
