create function pg_temp.verify_token_events(ok boolean, message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Token event assertion failed: %', message; end if;
end
$$;

select pg_temp.verify_token_events(
  (select relrowsecurity from pg_class where oid='public.eylo_api_token_events'::regclass),
  'audit table has RLS enabled'
);
select pg_temp.verify_token_events(
  not exists(select 1 from information_schema.columns where table_schema='public' and table_name='eylo_api_token_events' and column_name in ('token_hash','raw_token','secret_key')),
  'audit rows do not contain token credential material'
);

set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select pg_temp.verify_token_events(
  (select count(*)=2 and count(*) filter(where action='created')=1 and count(*) filter(where action='revoked')=1
     from public.eylo_api_token_events where token_id='a0000000-0000-4000-8000-000000000028'),
  'creation and revocation events are persisted for the owner'
);
do $$begin
  begin
    insert into public.eylo_api_token_events(user_id,token_id,token_name,action)
      values(auth.uid(),gen_random_uuid(),'Forged','created');
    raise exception 'Client wrote a forged token event';
  exception when insufficient_privilege then null;
  end;
end$$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select pg_temp.verify_token_events(
  (select count(*)=0 from public.eylo_api_token_events where token_id='a0000000-0000-4000-8000-000000000028'),
  'another account cannot read token events'
);
reset role;
select pg_temp.verify_token_events(
  not has_table_privilege('authenticated','public.eylo_api_token_events','INSERT')
  and not has_table_privilege('authenticated','public.eylo_api_token_events','UPDATE')
  and not has_table_privilege('authenticated','public.eylo_api_token_events','DELETE'),
  'authenticated clients cannot insert, update or delete audit rows'
);
