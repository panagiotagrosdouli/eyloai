create function pg_temp.check_funding(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Funding assertion failed: %',message; end if; end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into projects(id,user_id,data) values('10000000-0000-0000-0000-000000000003',auth.uid(),'{"title":"Second project"}');
insert into saved_opportunities(id,user_id,data) values('50000000-0000-0000-0000-000000000001',auth.uid(),'{"title":"Synthetic official notice fixture", "source_url":"https://www.grants.gov/fixture"}');
insert into grant_applications(user_id,saved_opportunity_id,project_id,notes) values
  (auth.uid(),'50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','First project draft'),
  (auth.uid(),'50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Second project draft');
select pg_temp.check_funding((select count(*)=2 from grant_applications),'one notice can have separate drafts per project');
with changed as (update grant_applications set notes='Revised first draft',version=2 where project_id='10000000-0000-0000-0000-000000000001' and version=1 returning *)
select pg_temp.check_funding((select count(*)=1 from changed),'grant CAS saves current revision');
with changed as (update grant_applications set notes='Stale overwrite',version=2 where project_id='10000000-0000-0000-0000-000000000001' and version=1 returning *)
select pg_temp.check_funding((select count(*)=0 from changed),'grant CAS rejects stale revision');
select pg_temp.check_funding((select notes='Second project draft' from grant_applications where project_id='10000000-0000-0000-0000-000000000003'),'second draft unchanged');
insert into saved_papers(user_id,data) values(auth.uid(),'{"source_id":"doi:10.1234/local-fixture","title":"Synthetic metadata fixture"}');
insert into saved_papers(user_id,data) values(auth.uid(),'{"source_id":"provider-one","doi":"10.1234/alias-fixture.v2"}');
do $$ begin
  begin
    insert into saved_papers(user_id,data) values(auth.uid(),'{"source_id":"doi:10.1234/local-fixture"}');
    raise exception 'Duplicate saved-paper identity unexpectedly succeeded';
  exception when unique_violation then null; end;
  begin
    insert into saved_papers(user_id,data) values(auth.uid(),'{"source_id":"provider-two","doi":"https://doi.org/10.1234/ALIAS-FIXTURE.v2"}');
    raise exception 'Duplicate canonical DOI unexpectedly succeeded';
  exception when unique_violation then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.check_funding((select count(*)=0 from grant_applications),'outsider cannot read grant drafts');
do $$ begin
  begin
    insert into grant_applications(user_id,saved_opportunity_id,project_id) values(auth.uid(),'50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
    raise exception 'Cross-owner grant association unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
end $$;
reset role;
