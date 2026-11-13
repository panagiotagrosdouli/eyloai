-- Run only in the disposable PostgreSQL runner, after workspace-postgres.sql.
-- Synthetic JWT identities; not hosted Supabase acceptance.
create function pg_temp.eyra_assert(ok boolean, message text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'EYRA assertion failed: %', message; end if;
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into ideas (id, user_id, data) values (
  '50000000-0000-0000-0000-000000000001', auth.uid(),
  '{"title":"Keep Idea Vault unchanged","category":"research","status":"active"}'
);
insert into eyra_conversations (id,user_id,title) values
  ('60000000-0000-0000-0000-000000000001',auth.uid(),'A private conversation'),
  ('60000000-0000-0000-0000-000000000003',auth.uid(),'A second conversation');
insert into eyra_messages (id,conversation_id,user_id,sequence_number,role,content) values
  ('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',auth.uid(),1,'user','{"text":"Private question"}'),
  ('70000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000001',auth.uid(),2,'assistant','{"text":"Private answer"}');
select pg_temp.eyra_assert((select count(*) = 2 from eyra_conversations), 'A sees own conversations');
select pg_temp.eyra_assert((select count(*) = 2 from eyra_messages), 'A sees own messages');
select pg_temp.eyra_assert((select count(*) = 1 from (select id from eyra_conversations order by updated_date desc,id desc limit 1 offset 1) page), 'stable paginated conversations');
select pg_temp.eyra_assert((select string_agg(role,',' order by sequence_number) = 'user,assistant' from eyra_messages), 'ordered messages');
update eyra_conversations set title = 'Updated title' where id = '60000000-0000-0000-0000-000000000001' and version = 1;
select pg_temp.eyra_assert((select version = 2 from eyra_conversations where id = '60000000-0000-0000-0000-000000000001'), 'version advanced');
with stale as (update eyra_conversations set title = 'Stale' where id = '60000000-0000-0000-0000-000000000001' and version = 1 returning id)
select pg_temp.eyra_assert((select count(*) = 0 from stale), 'stale write rejected');

do $$ declare rejected boolean; begin
  rejected := false;
  begin
    update eyra_conversations set user_id = '00000000-0000-0000-0000-000000000002'
      where id = '60000000-0000-0000-0000-000000000001';
  exception when check_violation then rejected := true; end;
  perform pg_temp.eyra_assert(rejected, 'owner change rejected');
  rejected := false;
  begin
    insert into eyra_messages (conversation_id,user_id,sequence_number,role,content)
    values ('60000000-0000-0000-0000-000000000001',auth.uid(),3,'assistant','{"text":"x","secret":"no"}');
  exception when check_violation then rejected := true; end;
  perform pg_temp.eyra_assert(rejected, 'unexpected provider keys rejected');
  rejected := false;
  begin
    insert into eyra_messages (conversation_id,user_id,sequence_number,role,content)
    values ('60000000-0000-0000-0000-000000000001',auth.uid(),3,'assistant','{"text":""}');
  exception when check_violation then rejected := true; end;
  perform pg_temp.eyra_assert(rejected, 'empty message rejected');
  rejected := false;
  begin
    insert into eyra_messages (conversation_id,user_id,sequence_number,role,content)
    values ('60000000-0000-0000-0000-000000000001',auth.uid(),3,'assistant','{"text":"duplicate"}');
  exception when unique_violation then rejected := true; end;
  -- Sequence 3 has not been inserted; duplicate sequencing is tested below.
  perform pg_temp.eyra_assert(not rejected, 'valid next message accepted');
  rejected := false;
  begin
    insert into eyra_messages (conversation_id,user_id,sequence_number,role,content)
    values ('60000000-0000-0000-0000-000000000001',auth.uid(),3,'assistant','{"text":"duplicate"}');
  exception when unique_violation then rejected := true; end;
  perform pg_temp.eyra_assert(rejected, 'duplicate message sequence rejected');
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.eyra_assert((select count(*) = 0 from eyra_conversations), 'B cannot see A threads');
select pg_temp.eyra_assert((select count(*) = 0 from eyra_messages), 'B cannot see A messages');
with updated as (update eyra_conversations set title = 'Hijacked' where id = '60000000-0000-0000-0000-000000000001' returning id)
select pg_temp.eyra_assert((select count(*) = 0 from updated), 'B cannot update A thread');
with removed as (delete from eyra_conversations where id = '60000000-0000-0000-0000-000000000001' returning id)
select pg_temp.eyra_assert((select count(*) = 0 from removed), 'B cannot delete A thread');

do $$ declare rejected boolean; begin
  rejected := false;
  begin
    insert into eyra_messages (conversation_id,user_id,sequence_number,role,content)
    values ('60000000-0000-0000-0000-000000000001',auth.uid(),4,'user','{"text":"attack"}');
  exception when insufficient_privilege or foreign_key_violation then rejected := true; end;
  perform pg_temp.eyra_assert(rejected, 'B cannot attach to A parent');
  rejected := false;
  begin
    insert into eyra_messages (conversation_id,user_id,sequence_number,role,content)
    values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',4,'user','{"text":"impersonation"}');
  exception when insufficient_privilege then rejected := true; end;
  perform pg_temp.eyra_assert(rejected, 'B cannot forge A owner');
end $$;
insert into eyra_conversations (id,user_id,title) values
  ('60000000-0000-0000-0000-000000000002',auth.uid(),'B conversation');
select pg_temp.eyra_assert((select count(*) = 1 from eyra_conversations), 'B sees only B thread');

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.eyra_assert((select count(*) = 2 from eyra_conversations), 'A still sees only A threads');
delete from eyra_conversations where id = '60000000-0000-0000-0000-000000000001';
select pg_temp.eyra_assert((select count(*) = 0 from eyra_messages), 'delete cascades messages');
select pg_temp.eyra_assert((select count(*) = 1 from ideas where data->>'title' = 'Keep Idea Vault unchanged'), 'Idea Vault unchanged');
select pg_temp.eyra_assert((select count(*) = 1 from projects where data->>'title' = 'Alpha project'), 'other EYLO tables unchanged');

reset role;
select pg_temp.eyra_assert((select count(*) = 0 from eyra_messages where conversation_id = '60000000-0000-0000-0000-000000000001'), 'cascade persisted');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.save_eyra_conversation_snapshot('Explicit snapshot','[{"role":"user","text":"Plan methods","sources":[]},{"role":"assistant","text":"Review [P1]","sources":[{"id":"P1","url":"https://doi.org/10.1234/test","title":"Supplied source"}]}]');
select pg_temp.eyra_assert((select count(*) = 2 from eyra_messages m join eyra_conversations c on c.id=m.conversation_id where c.title='Explicit snapshot'), 'snapshot persisted atomically');
do $$ begin
  begin
    perform public.save_eyra_conversation_snapshot('Invalid snapshot','[{"role":"tool","text":"bad"}]');
    raise exception 'Invalid snapshot unexpectedly succeeded';
  exception when invalid_parameter_value then null; end;
end $$;
select pg_temp.eyra_assert((select count(*) = 0 from eyra_conversations where title='Invalid snapshot'), 'failed snapshot rolls back parent');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.eyra_assert((select count(*)=0 from eyra_conversations where title='Explicit snapshot'), 'outsider cannot read snapshot');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.save_eyra_conversation_snapshot('Retry snapshot','[{"role":"user","text":"Stable retry","sources":[]}]','60000000-0000-4000-8000-000000000020');
select public.save_eyra_conversation_snapshot('Retry snapshot','[{"role":"user","text":"Stable retry","sources":[]}]','60000000-0000-4000-8000-000000000020');
select pg_temp.eyra_assert((select count(*)=1 from eyra_messages where conversation_id='60000000-0000-4000-8000-000000000020'), 'same snapshot retry never duplicates messages');
do $$ begin
  begin
    perform public.save_eyra_conversation_snapshot('Changed title','[{"role":"user","text":"Stable retry","sources":[]}]','60000000-0000-4000-8000-000000000020');
    raise exception 'Conflicting snapshot ID unexpectedly succeeded';
  exception when unique_violation then null; end;
end $$;
with removed as (delete from eyra_conversations where id='60000000-0000-4000-8000-000000000020' and version=2 returning id)
select pg_temp.eyra_assert((select count(*)=0 from removed), 'stale version cannot delete snapshot');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
with removed as (delete from eyra_conversations where id='60000000-0000-4000-8000-000000000020' returning id)
select pg_temp.eyra_assert((select count(*)=0 from removed), 'outsider cannot delete snapshot');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
delete from eyra_conversations where id='60000000-0000-4000-8000-000000000020' and version=1;
select pg_temp.eyra_assert((select count(*)=0 from eyra_messages where conversation_id='60000000-0000-4000-8000-000000000020'), 'owner deletion cascades snapshot sources/messages');
reset role;
