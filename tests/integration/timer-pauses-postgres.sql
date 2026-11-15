-- Real PostgreSQL, no hosted services: explicit owner identity fixtures.
create function pg_temp.check_learning(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Timer assertion failed: %', message; end if; end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.time_entries(id,user_id,description,started_at)
values ('70000000-0000-4000-8000-000000000001',auth.uid(),'Pause test',now()-interval '2 hours');
do $$ declare entry public.time_entries; begin
  select * into entry from public.transition_time_entry('70000000-0000-4000-8000-000000000001','pause',0);
  perform pg_temp.check_learning(entry.timer_revision=1 and jsonb_array_length(entry.pause_intervals)=1 and entry.pause_intervals->0->'ended_at'='null'::jsonb, 'pause is persisted with revision');
  begin
    perform public.transition_time_entry(entry.id,'resume',0);
    raise exception 'Stale timer update unexpectedly succeeded';
  exception when serialization_failure then null; end;
  begin
    insert into public.time_entries(user_id,description,started_at) values(auth.uid(),'Second while paused',now());
    raise exception 'Paused timer failed to reserve active slot';
  exception when unique_violation then null; end;
  select * into entry from public.transition_time_entry(entry.id,'resume',1);
  perform pg_temp.check_learning(entry.timer_revision=2 and entry.pause_intervals->0->>'ended_at' is not null, 'resume closes pause');
  select * into entry from public.transition_time_entry(entry.id,'resume',2);
  perform pg_temp.check_learning(entry.timer_revision=2, 'same-state retry does not modify history');
  select * into entry from public.transition_time_entry(entry.id,'pause',2);
  select * into entry from public.transition_time_entry(entry.id,'stop',3);
  perform pg_temp.check_learning(entry.timer_revision=4 and entry.ended_at is not null and entry.pause_intervals->1->>'ended_at' is not null, 'stop closes ongoing pause');
  begin
    perform public.transition_time_entry(entry.id,'resume',4);
    raise exception 'Stopped timer resumed unexpectedly';
  exception when invalid_parameter_value then null; end;
end $$;
-- Direct owner writes also advance the compare-and-set revision.
update public.time_entries set description='Edited pause test',timer_revision=0 where id='70000000-0000-4000-8000-000000000001';
select pg_temp.check_learning((select timer_revision=5 from public.time_entries where id='70000000-0000-4000-8000-000000000001'), 'owner edits advance revision');
do $$ begin
  begin
    update public.time_entries set pause_intervals='[{"started_at":"invalid","ended_at":null}]' where id='70000000-0000-4000-8000-000000000001';
    raise exception 'Invalid pause data accepted';
  exception when check_violation then null; end;
  begin
    update public.time_entries set pause_intervals=jsonb_build_array(
      jsonb_build_object('started_at',now()-interval '1 hour','ended_at',now()-interval '20 minutes'),
      jsonb_build_object('started_at',now()-interval '30 minutes','ended_at',now()-interval '10 minutes'))
      where id='70000000-0000-4000-8000-000000000001';
    raise exception 'Overlapping pauses accepted';
  exception when check_violation then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  begin
    perform public.transition_time_entry('70000000-0000-4000-8000-000000000001','pause',5);
    raise exception 'Outsider transition succeeded';
  exception when insufficient_privilege then null; end;
  perform pg_temp.check_learning(not exists(select 1 from public.time_entries where id='70000000-0000-4000-8000-000000000001'), 'outsider cannot read pause history');
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.transition_time_entry('70000000-0000-4000-8000-000000000001','pause',5);
    raise exception 'Anonymous transition succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
