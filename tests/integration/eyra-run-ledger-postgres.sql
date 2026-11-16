-- EYRA run ledger test on disposable PostgreSQL only. Never remote.
-- Executed after workspace account fixtures, before account deletion tests.
create function pg_temp.eyra_run_assert(ok boolean, reason text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'EYRA run ledger: %', reason; end if;
end $$;

reset role;
insert into public.eyra_agent_runs(id,user_id,request_id,request_hash,input_preview)
values
 ('b0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  'c0000000-0000-4000-8000-000000000001',repeat('a',64),'Private user one operation'),
 ('b0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000002',
  'c0000000-0000-4000-8000-000000000002',repeat('b',64),'Private user two operation');

insert into public.eyra_agent_actions(id,run_id,user_id,call_id,tool_name,arguments_hash)
values
 ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001','create-project','project.create',repeat('c',64)),
 ('d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000002','read-projects','project.list',repeat('d',64));

select pg_temp.eyra_run_assert((select count(*)=2 from public.eyra_agent_runs),
  'service ledger inserted two distinct owners');
do $$ declare refused boolean := false; begin
  begin
    insert into public.eyra_agent_runs(user_id,request_id,request_hash,input_preview)
    values('00000000-0000-0000-0000-000000000001',
      'c0000000-0000-4000-8000-000000000001',repeat('a',64),'Duplicate');
  exception when unique_violation then refused := true; end;
  perform pg_temp.eyra_run_assert(refused, 'duplicate run request ID rejected');
  refused := false;
  begin
    insert into public.eyra_agent_actions(run_id,user_id,call_id,tool_name,arguments_hash)
    values('b0000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000001','create-project','project.create',repeat('c',64));
  exception when unique_violation then refused := true; end;
  perform pg_temp.eyra_run_assert(refused, 'duplicate call ID rejected');
  refused := false;
  begin
    insert into public.eyra_agent_actions(run_id,user_id,call_id,tool_name,arguments_hash)
    values('b0000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000002','foreign-link','project.create',repeat('c',64));
  exception when foreign_key_violation then refused := true; end;
  perform pg_temp.eyra_run_assert(refused, 'foreign-owner action rejected by composite foreign key');
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.eyra_run_assert((select count(*)=1 from public.eyra_agent_runs), 'owner A sees one run');
select pg_temp.eyra_run_assert((select count(*)=1 from public.eyra_agent_actions), 'owner A sees one action');
do $$ declare refused boolean := false; begin
  begin
    update public.eyra_agent_runs set status='cancelled',finished_at=now();
  exception when insufficient_privilege then refused := true; end;
  perform pg_temp.eyra_run_assert(refused, 'client may not write status directly');
  refused := false;
  begin
    insert into public.eyra_agent_runs(user_id,request_id,request_hash,input_preview)
    values(auth.uid(),gen_random_uuid(),repeat('f',64),'Forbidden direct insert');
  exception when insufficient_privilege then refused := true; end;
  perform pg_temp.eyra_run_assert(refused, 'client cannot bypass server-only run creation');
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.eyra_run_assert((select count(*)=1 from public.eyra_agent_runs), 'owner B sees own run only');
select pg_temp.eyra_run_assert((select count(*)=1 from public.eyra_agent_actions), 'owner B sees own action only');
select pg_temp.eyra_run_assert(
  (select count(*)=0 from public.eyra_agent_runs where id='b0000000-0000-4000-8000-000000000001'),
  'owner B cannot read owner A run');

reset role;
update public.eyra_agent_runs set status='completed',finished_at=now()
where id='b0000000-0000-4000-8000-000000000001' and status='running';
with stale as (
  update public.eyra_agent_runs set status='cancelled'
  where id='b0000000-0000-4000-8000-000000000001' and status='running'
  returning id
)
select pg_temp.eyra_run_assert((select count(*)=0 from stale), 'terminal run is not cancellable via running CAS');

delete from public.eyra_agent_runs where user_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002');
select pg_temp.eyra_run_assert((select count(*)=0 from public.eyra_agent_actions),
  'deleting runs cascades to action records');
