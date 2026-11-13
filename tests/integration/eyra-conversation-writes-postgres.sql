-- Disposable local PostgreSQL two-owner checks for transactional EYRA writes.
-- The workspace fixture already creates synthetic auth users A and B.
create function pg_temp.assert_eyra_write(ok boolean, reason text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'EYRA write assertion failed: %', reason;
  end if;
end $$;

-- Owner A: identical create retries return the same row; inserts touch no Ideas.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert_eyra_write(
  (public.eyra_create_conversation('80000000-0000-0000-0000-000000000001', 'A thread')->>'title') = 'A thread',
  'owner creates conversation'
);
select pg_temp.assert_eyra_write(
  (public.eyra_create_conversation('80000000-0000-0000-0000-000000000001', 'A thread')->>'version')::int = 1,
  'creation retry returns original'
);
select pg_temp.assert_eyra_write(
  (select count(*) = 1 from eyra_conversations where id = '80000000-0000-0000-0000-000000000001'),
  'creation retry did not duplicate'
);
select pg_temp.assert_eyra_write(
  (public.eyra_append_message(
    '80000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001', 'user', 'A question'
  )->>'sequence_number')::bigint = 1, 'first append gets sequence 1'
);
select pg_temp.assert_eyra_write(
  (public.eyra_append_message(
    '80000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001', 'user', 'A question'
  )->>'sequence_number')::bigint = 1, 'retry returns same sequence'
);
select pg_temp.assert_eyra_write(
  (select count(*) = 1 from eyra_messages where conversation_id = '80000000-0000-0000-0000-000000000001'),
  'same request is exactly once'
);
select pg_temp.assert_eyra_write(
  (select version = 2 from eyra_conversations where id = '80000000-0000-0000-0000-000000000001'),
  'successful append increments version once'
);

do $$ declare blocked boolean; begin
  blocked := false;
  begin
    perform public.eyra_append_message(
      '80000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001', 'assistant', 'Different content');
  exception when unique_violation then blocked := true; end;
  perform pg_temp.assert_eyra_write(blocked, 'mismatched retry must conflict');

  blocked := false;
  begin
    perform public.eyra_append_message(
      '80000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002', 'system', 'Illegal role');
  exception when invalid_parameter_value then blocked := true; end;
  perform pg_temp.assert_eyra_write(blocked, 'invalid roles rejected');

  blocked := false;
  begin
    perform public.eyra_create_conversation(
      '80000000-0000-0000-0000-000000000001', 'Different title');
  exception when unique_violation then blocked := true; end;
  perform pg_temp.assert_eyra_write(blocked, 'mismatched create retry conflicts');
end $$;
select pg_temp.assert_eyra_write(
  (select count(*) = 1 from eyra_messages where conversation_id = '80000000-0000-0000-0000-000000000001'),
  'failed append left no partial messages'
);

-- Owner B: both RPCs refuse to attach to or impersonate owner A.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare blocked boolean; begin
  blocked := false;
  begin
    perform public.eyra_append_message(
      '80000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000003', 'user', 'B attack');
  exception when no_data_found then blocked := true; end;
  perform pg_temp.assert_eyra_write(blocked, 'B cannot append to A thread');

  blocked := false;
  begin
    perform public.eyra_create_conversation(
      '80000000-0000-0000-0000-000000000001', 'A thread');
  exception when no_data_found then blocked := true; end;
  perform pg_temp.assert_eyra_write(blocked, 'B cannot claim A conversation UUID');
end $$;
select pg_temp.assert_eyra_write(
  (select count(*) = 0 from eyra_messages), 'B sees none of A messages'
);
select pg_temp.assert_eyra_write(
  (public.eyra_create_conversation(
    '80000000-0000-0000-0000-000000000002','B private thread')->>'title') = 'B private thread',
  'B creates own thread'
);
select pg_temp.assert_eyra_write(
  (public.eyra_append_message(
    '80000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000004','assistant','B reply'
  )->>'sequence_number')::bigint = 1,
  'B appends own message'
);

-- PostgreSQL role grants, no anonymous RPC execution.
reset role;
select pg_temp.assert_eyra_write(
  not has_function_privilege(
    'anon','public.eyra_append_message(uuid,uuid,text,text)','EXECUTE'),
  'anonymous role has no RPC grant'
);
select pg_temp.assert_eyra_write(
  not has_function_privilege(
    'service_role','public.eyra_append_message(uuid,uuid,text,text)','EXECUTE'),
  'service role has no RPC grant'
);
select pg_temp.assert_eyra_write(
  (select count(*) = 1 from eyra_messages where conversation_id = '80000000-0000-0000-0000-000000000001'),
  'failed retries left exactly one A message'
);
-- Original existing owner A Idea Vault and other workspace records persist.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert_eyra_write(
  (select count(*) = 1 from projects where data->>'title' = 'Alpha project'),
  'Projects unaffected'
);
select pg_temp.assert_eyra_write(
  (select count(*) = 1 from notes where data->>'title' = 'Alpha note'),
  'Notes unaffected'
);
reset role;
