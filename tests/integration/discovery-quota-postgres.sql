-- The only limiter schema selected for this integration; no raw IP addresses.
create function pg_temp.check_quota(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Quota assertion failed: %',message; end if; end $$;
set role service_role;
select pg_temp.check_quota((select allowed and remaining=1 from public.consume_discovery_rate_limit(repeat('a',64),2,600)), 'first request');
select pg_temp.check_quota((select allowed and remaining=0 from public.consume_discovery_rate_limit(repeat('a',64),2,600)), 'last allowed request');
select pg_temp.check_quota((select not allowed and retry_after_seconds>0 from public.consume_discovery_rate_limit(repeat('a',64),2,600)), 'quota exhausted');
select pg_temp.check_quota((select not allowed from public.consume_discovery_rate_limit(repeat('a',64),2,600)), 'quota stays exhausted');
select pg_temp.check_quota((select request_count=3 from public.discovery_rate_limits where subject_hash=repeat('a',64)), 'denied counters remain bounded');
reset role;
set role authenticated;
do $$ begin
  begin
    perform public.consume_discovery_rate_limit(repeat('b',64),2,600);
    raise exception 'Authenticated client unexpectedly called privileged quota RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
