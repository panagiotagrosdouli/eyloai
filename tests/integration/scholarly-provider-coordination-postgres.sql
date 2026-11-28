-- Exercise the provider coordination migration on disposable PostgreSQL only.
-- All provider rows, leases and cache entries are rolled back below.
begin;

create function pg_temp.assert_provider_coordination(ok boolean, message text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'Provider coordination assertion failed: %', message;
  end if;
end
$$;

select pg_temp.assert_provider_coordination(
  to_regprocedure('public.read_scholarly_provider_cache(text)') is not null
  and to_regprocedure('public.write_scholarly_provider_cache(text,text,text,text,integer)') is not null
  and to_regprocedure('public.reserve_scholarly_provider_slot(text,text,integer,integer,integer)') is not null
  and to_regprocedure('public.finish_scholarly_provider_request(text,uuid,integer,integer)') is not null,
  'all coordinator RPC signatures exist'
);

select pg_temp.assert_provider_coordination(
  (select count(*) = 3
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('scholarly_provider_state','scholarly_provider_leases','scholarly_response_cache')
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
      ))
  and not exists (
    select 1
      from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
      cross join (values ('scholarly_provider_state'), ('scholarly_provider_leases'), ('scholarly_response_cache')) tables(table_name)
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privileges(privilege_name)
     where has_table_privilege(roles.role_name, format('public.%I', tables.table_name), privileges.privilege_name)
  ),
  'coordination tables are private, RLS enabled, policy-free, and grant no direct client/service-role table privileges'
);

select pg_temp.assert_provider_coordination(
  (select count(*) = 4
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('read_scholarly_provider_cache','write_scholarly_provider_cache','reserve_scholarly_provider_slot','finish_scholarly_provider_request')
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=""%')
  and has_function_privilege('service_role', 'public.read_scholarly_provider_cache(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.write_scholarly_provider_cache(text,text,text,text,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.reserve_scholarly_provider_slot(text,text,integer,integer,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finish_scholarly_provider_request(text,uuid,integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.read_scholarly_provider_cache(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.write_scholarly_provider_cache(text,text,text,text,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reserve_scholarly_provider_slot(text,text,integer,integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.finish_scholarly_provider_request(text,uuid,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.read_scholarly_provider_cache(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.write_scholarly_provider_cache(text,text,text,text,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.reserve_scholarly_provider_slot(text,text,integer,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finish_scholarly_provider_request(text,uuid,integer,integer)', 'EXECUTE'),
  'all RPCs are SECURITY DEFINER with an empty search_path and service-role-only execution'
);

set role service_role;
do $$
declare
  cache_entry record;
  lease record;
  contender record;
  cooldown record;
  completed boolean;
begin
  if not public.write_scholarly_provider_cache(
    repeat('a', 64), 'crossref', '{"items":[{"id":"fixture"}]}', 'application/json', 300
  ) then
    raise exception 'Provider cache write was not confirmed';
  end if;
  select * into cache_entry from public.read_scholarly_provider_cache(repeat('a', 64));
  if cache_entry.body <> '{"items":[{"id":"fixture"}]}' or cache_entry.content_type <> 'application/json' then
    raise exception 'Provider cache read did not preserve the response';
  end if;

  select * into lease from public.reserve_scholarly_provider_slot('crossref', repeat('b', 64), 0, 1, 45);
  if not lease.allowed or lease.status <> 'acquired' or lease.lease_id is null then
    raise exception 'First provider lease was not granted';
  end if;
  select * into contender from public.reserve_scholarly_provider_slot('crossref', repeat('c', 64), 0, 1, 45);
  if contender.allowed or contender.status <> 'concurrency_limited' then
    raise exception 'Provider concurrency limit was not enforced';
  end if;
  select * into contender from public.reserve_scholarly_provider_slot('crossref', repeat('b', 64), 0, 1, 45);
  if contender.allowed or contender.status <> 'deduplicated' then
    raise exception 'Duplicate provider query was not deduplicated';
  end if;
  select public.finish_scholarly_provider_request('crossref', lease.lease_id, 429, 7) into completed;
  if completed is distinct from true then
    raise exception 'Finishing a provider 429 did not release its lease';
  end if;
  select * into cooldown from public.reserve_scholarly_provider_slot('crossref', repeat('d', 64), 0, 1, 45);
  if cooldown.allowed or cooldown.status <> 'cooldown' or cooldown.retry_after_seconds < 1 then
    raise exception 'Retry-After did not establish a provider cooldown';
  end if;
  if public.finish_scholarly_provider_request('crossref', lease.lease_id, 200, 0) then
    raise exception 'A lease was completed twice';
  end if;

  select * into lease from public.reserve_scholarly_provider_slot('openalex', repeat('e', 64), 60000, 2, 45);
  if not lease.allowed or lease.status <> 'acquired' then
    raise exception 'First provider rate-limit probe was not granted';
  end if;
  select * into contender from public.reserve_scholarly_provider_slot('openalex', repeat('f', 64), 60000, 2, 45);
  if contender.allowed or contender.status <> 'rate_limited' or contender.retry_after_seconds < 1 then
    raise exception 'Provider minimum request interval was not enforced';
  end if;
  select public.finish_scholarly_provider_request('openalex', lease.lease_id, 200, 0) into completed;
  if completed is distinct from true then
    raise exception 'Successful provider lease did not finish';
  end if;
end
$$;

reset role;
set role authenticated;
do $$
begin
  begin
    perform public.read_scholarly_provider_cache(repeat('a', 64));
    raise exception 'Authenticated role unexpectedly executed the private provider cache RPC';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

rollback;
