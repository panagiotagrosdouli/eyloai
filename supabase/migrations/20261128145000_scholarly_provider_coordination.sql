-- Shared provider pacing, leases, cooldown state, and short-lived public-result
-- cache for independent serverless instances. Research queries are never stored.
create table public.scholarly_provider_state (
  provider text primary key check (provider in ('openalex','semantic_scholar','arxiv','europe_pmc','crossref')),
  next_request_at timestamptz not null default '-infinity',
  cooldown_until timestamptz not null default '-infinity',
  consecutive_failures integer not null default 0 check (consecutive_failures between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.scholarly_provider_leases (
  provider text not null references public.scholarly_provider_state(provider) on delete cascade,
  lease_id uuid not null,
  expires_at timestamptz not null,
  primary key (provider, lease_id)
);
create index scholarly_provider_leases_expiry_idx
  on public.scholarly_provider_leases (provider, expires_at);

create table public.scholarly_response_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  provider text not null check (provider in ('openalex','semantic_scholar','arxiv','europe_pmc','crossref')),
  body text not null check (octet_length(body) <= 2097152),
  content_type text not null check (content_type in ('application/json', 'application/atom+xml')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index scholarly_response_cache_expiry_idx
  on public.scholarly_response_cache (expires_at);

alter table public.scholarly_provider_state enable row level security;
alter table public.scholarly_provider_leases enable row level security;
alter table public.scholarly_response_cache enable row level security;
revoke all on public.scholarly_provider_state, public.scholarly_provider_leases,
  public.scholarly_response_cache from public, anon, authenticated, service_role;

create function public.reserve_scholarly_provider_slot(
  p_provider text,
  p_min_interval_ms integer,
  p_max_concurrent integer,
  p_lease_seconds integer
)
returns table (allowed boolean, status text, retry_after_seconds integer, lease_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  state public.scholarly_provider_state;
  active_count integer;
  now_at timestamptz := clock_timestamp();
  new_lease uuid;
begin
  if p_provider is null or p_min_interval_ms is null or p_max_concurrent is null or p_lease_seconds is null
    or p_provider not in ('openalex','semantic_scholar','arxiv','europe_pmc','crossref')
    or p_min_interval_ms not between 0 and 60000
    or p_max_concurrent not between 1 and 20
    or p_lease_seconds not between 5 and 120 then
    raise exception 'Invalid scholarly provider reservation' using errcode = '22023';
  end if;
  insert into public.scholarly_provider_state(provider) values (p_provider)
    on conflict (provider) do nothing;
  select * into state from public.scholarly_provider_state s
    where s.provider = p_provider for update;
  delete from public.scholarly_provider_leases l
    where l.provider = p_provider and l.expires_at <= now_at;
  select count(*) into active_count from public.scholarly_provider_leases l
    where l.provider = p_provider and l.expires_at > now_at;

  if state.cooldown_until > now_at then
    return query select false, 'cooldown', greatest(1, ceil(extract(epoch from state.cooldown_until-now_at))::integer), null::uuid;
    return;
  end if;
  if state.next_request_at > now_at then
    return query select false, 'rate_limited', greatest(1, ceil(extract(epoch from state.next_request_at-now_at))::integer), null::uuid;
    return;
  end if;
  if active_count >= p_max_concurrent then
    return query select false, 'concurrency_limited', 1, null::uuid;
    return;
  end if;

  new_lease := gen_random_uuid();
  insert into public.scholarly_provider_leases(provider, lease_id, expires_at)
    values (p_provider, new_lease, now_at + make_interval(secs => p_lease_seconds));
  update public.scholarly_provider_state s set
    next_request_at = now_at + make_interval(secs => p_min_interval_ms::double precision / 1000),
    updated_at = now_at
    where s.provider = p_provider;
  return query select true, 'acquired', 0, new_lease;
end;
$$;

create function public.finish_scholarly_provider_request(
  p_provider text,
  p_lease_id uuid,
  p_status integer,
  p_retry_after_seconds integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
  now_at timestamptz := clock_timestamp();
begin
  if p_provider is null or p_lease_id is null or p_status is null or p_retry_after_seconds is null
    or p_provider not in ('openalex','semantic_scholar','arxiv','europe_pmc','crossref')
    or p_lease_id is null or p_status not between 100 and 599
    or p_retry_after_seconds not between 0 and 86400 then
    raise exception 'Invalid scholarly provider completion' using errcode = '22023';
  end if;
  delete from public.scholarly_provider_leases l
    where l.provider = p_provider and l.lease_id = p_lease_id;
  get diagnostics removed = row_count;
  if removed = 0 then return false; end if;

  if p_status = 429 then
    update public.scholarly_provider_state s set
      cooldown_until = greatest(s.cooldown_until, now_at + make_interval(secs => greatest(1,p_retry_after_seconds))),
      updated_at = now_at where s.provider = p_provider;
  elsif p_status >= 500 then
    update public.scholarly_provider_state s set
      consecutive_failures = least(100, s.consecutive_failures + 1),
      cooldown_until = case when s.consecutive_failures + 1 >= 3 then greatest(s.cooldown_until, now_at + interval '15 seconds') else s.cooldown_until end,
      updated_at = now_at where s.provider = p_provider;
  elsif p_status between 200 and 299 then
    update public.scholarly_provider_state s set consecutive_failures = 0,
      cooldown_until = '-infinity', updated_at = now_at where s.provider = p_provider;
  end if;
  return true;
end;
$$;

create function public.read_scholarly_provider_cache(p_cache_key text)
returns table (body text, content_type text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid scholarly cache key' using errcode = '22023';
  end if;
  return query select c.body, c.content_type from public.scholarly_response_cache c
    where c.cache_key = p_cache_key and c.expires_at > clock_timestamp();
end;
$$;

create function public.write_scholarly_provider_cache(
  p_cache_key text,
  p_provider text,
  p_body text,
  p_content_type text,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
  cache_rows bigint;
begin
  if p_cache_key is null or p_provider is null or p_body is null or p_content_type is null or p_ttl_seconds is null
    or p_cache_key !~ '^[a-f0-9]{64}$'
    or p_provider not in ('openalex','semantic_scholar','arxiv','europe_pmc','crossref')
    or p_body is null or octet_length(p_body) > 2097152
    or p_content_type not in ('application/json','application/atom+xml')
    or p_ttl_seconds not between 1 and 21600 then
    raise exception 'Invalid scholarly cache entry' using errcode = '22023';
  end if;
  insert into public.scholarly_response_cache(cache_key,provider,body,content_type,expires_at,created_at)
    values (p_cache_key,p_provider,p_body,p_content_type,now_at+make_interval(secs=>p_ttl_seconds),now_at)
    on conflict (cache_key) do update set provider=excluded.provider,body=excluded.body,
      content_type=excluded.content_type,expires_at=excluded.expires_at,created_at=excluded.created_at;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eylo_scholarly_cache_capacity_v1', 0));
  delete from public.scholarly_response_cache c where c.cache_key in (
    select stale.cache_key from public.scholarly_response_cache stale
     where stale.expires_at <= now_at order by stale.expires_at limit 500
  );
  select count(*) into cache_rows from public.scholarly_response_cache;
  if cache_rows > 10000 then
    delete from public.scholarly_response_cache c where c.cache_key in (
      select oldest.cache_key from public.scholarly_response_cache oldest
       order by oldest.created_at limit 500
    );
  end if;
  return true;
end;
$$;

revoke all on function public.reserve_scholarly_provider_slot(text,integer,integer,integer),
  public.finish_scholarly_provider_request(text,uuid,integer,integer),
  public.read_scholarly_provider_cache(text),
  public.write_scholarly_provider_cache(text,text,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.reserve_scholarly_provider_slot(text,integer,integer,integer),
  public.finish_scholarly_provider_request(text,uuid,integer,integer),
  public.read_scholarly_provider_cache(text),
  public.write_scholarly_provider_cache(text,text,text,text,integer)
  to service_role;
