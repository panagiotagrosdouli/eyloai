-- Shared, atomic, privacy-preserving rate limit for public scholarly search.
-- The application stores only an HMAC of the trusted client IP, never the IP.
create table if not exists public.discovery_rate_limits (
  subject_hash text primary key check (subject_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_rate_limits_updated_idx
  on public.discovery_rate_limits (updated_at);

alter table public.discovery_rate_limits enable row level security;
revoke all on public.discovery_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.discovery_rate_limits to service_role;

create or replace function public.consume_discovery_rate_limit(
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  saved_window timestamptz;
  saved_count integer;
  observed_at timestamptz := clock_timestamp();
begin
  if p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$'
    or p_limit is null or p_limit < 1 or p_limit > 10000
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid discovery rate-limit input' using errcode = '22023';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from observed_at) / p_window_seconds) * p_window_seconds
  );

  insert into public.discovery_rate_limits as existing (
    subject_hash, window_started_at, request_count, updated_at
  ) values (
    p_subject_hash, current_window, 1, observed_at
  )
  on conflict (subject_hash) do update set
    window_started_at = case
      when existing.window_started_at < current_window then current_window
      else existing.window_started_at
    end,
    request_count = case
      when existing.window_started_at < current_window then 1
      else least(p_limit + 1, existing.request_count + 1)
    end,
    updated_at = observed_at
  returning existing.window_started_at, existing.request_count
    into saved_window, saved_count;

  if random() < 0.01 then
    with stale_rows as (
      select ctid
        from public.discovery_rate_limits
       where updated_at < observed_at - interval '24 hours'
       order by updated_at
       limit 500
    )
    delete from public.discovery_rate_limits target
     using stale_rows
     where target.ctid = stale_rows.ctid;
  end if;

  return query select
    saved_count <= p_limit,
    greatest(0, p_limit - saved_count),
    greatest(0, ceil(extract(epoch from (saved_window + make_interval(secs => p_window_seconds) - observed_at)))::integer),
    saved_window + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_discovery_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_discovery_rate_limit(text, integer, integer) to service_role;
