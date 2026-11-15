create function pg_temp.verify_research_catalog(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Research catalog assertion failed: %', message; end if; end$;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
insert into research_datasets(id,user_id,data) values(
  '20000000-0000-4000-8000-000000000001', auth.uid(),
  jsonb_build_object('fileName','study.csv','sha256',repeat('a',64),'byteLength',64,'rowCount',12,'columnCount',3,'addedAt','2026-11-12T10:00:00Z')
);
select pg_temp.verify_research_catalog((select count(*)=1 from research_datasets where user_id=auth.uid()),'owner can save catalog metadata');
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select pg_temp.verify_research_catalog((select count(*)=0 from research_datasets),'second account cannot read the first account catalog');
do $$begin
  begin
    insert into research_datasets(user_id,data) values('00000000-0000-4000-8000-000000000001','{"fileName":"foreign.csv","byteLength":1,"rowCount":1,"columnCount":1,"addedAt":"2026-11-12T10:00:00Z"}');
    raise exception 'cross-account catalog insert accepted';
  exception when insufficient_privilege then null;
  end;
end$$;
do $$begin
  begin
    insert into research_datasets(user_id,data) values(auth.uid(),'{"fileName":"bad.csv","byteLength":99999999,"rowCount":1,"columnCount":1,"addedAt":"2026-11-12T10:00:00Z"}');
    raise exception 'invalid catalog dimensions accepted';
  exception when check_violation then null;
  end;
end$$;
do $$begin
  begin
    insert into research_datasets(user_id,data) values(auth.uid(),'{"fileName":"raw.csv","byteLength":64,"rowCount":1,"columnCount":1,"addedAt":"2026-11-12T10:00:00Z","rawRows":[["private value"]]}');
    raise exception 'raw dataset values accepted into cloud catalog';
  exception when check_violation then null;
  end;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$begin
  begin
    insert into research_datasets(user_id,data) values(auth.uid(),jsonb_build_object('fileName','duplicate.csv','sha256',repeat('a',64),'byteLength',64,'rowCount',12,'columnCount',3,'addedAt','2026-11-12T10:00:00Z'));
    raise exception 'duplicate owner fingerprint accepted';
  exception when unique_violation then null;
  end;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select pg_temp.verify_research_catalog((select count(*)=0 from research_datasets where user_id='00000000-0000-4000-8000-000000000001'),'foreign catalog rows remain invisible after invalid writes');
reset role;
select pg_temp.verify_research_catalog(not has_table_privilege('anon','public.research_datasets','select'),'anonymous users cannot read catalog metadata');
