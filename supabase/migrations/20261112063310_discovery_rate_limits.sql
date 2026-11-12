-- Persistent request throttling for the public scholarly proxy.
-- Only a keyed HMAC of the Vercel-verified client IP is stored; raw IPs never
-- reach the database. The function is invoker-security and executable only
-- by the server's service role. No user-facing Data API role gets access.

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.discovery_rate_limit_counters (
  client_hash text primary key check (client_hash ~ '^[a-f0-9]{64}$'),
  tokens numeric(16, 9) not null check (tokens >= 0),
  last_refill_at timestamptz not null,
  last_allowed boolean not null,
  updated_at timestamptz not null default clock_timestamp()
);

alter table private.discovery_rate_limit_counters enable row level security;
revoke all on table private.discovery_rate_limit_counters from public, anon, authenticated;
grant select, insert, update, delete on table private.discovery_rate_limit_counters to service_role;

create index if not exists discovery_rate_limit_counters_updated_idx
  on private.discovery_rate_limit_counters (updated_at);

create or replace function private.purge_discovery_rate_limit_counters()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from private.discovery_rate_limit_counters
   where updated_at < clock_timestamp() - interval '1 day';
$$;

revoke all on function private.purge_discovery_rate_limit_counters() from public, anon, authenticated;
grant execute on function private.purge_discovery_rate_limit_counters() to service_role;

-- Re-running a partially applied migration must leave exactly one cleanup job.
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'eylo-discovery-rate-limit-cleanup';

-- Cleanup every five minutes; an idle counter is retained for at most 24 h + 5 min.
select cron.schedule(
  'eylo-discovery-rate-limit-cleanup',
  '*/5 * * * *',
  'select private.purge_discovery_rate_limit_counters();'
);

create or replace function public.consume_discovery_rate_limit(
  p_client_hash text,
  p_window_seconds integer,
  p_max_requests integer,
  p_now timestamptz default null
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_tokens numeric(16, 9);
  v_allowed boolean;
begin
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$'
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600
    or p_max_requests is null or p_max_requests < 1 or p_max_requests > 10000 then
    raise exception 'Invalid discovery limit parameters' using errcode = '22023';
  end if;

  insert into private.discovery_rate_limit_counters as current_counter
    (client_hash, tokens, last_refill_at, last_allowed, updated_at)
  values (p_client_hash, p_max_requests - 1, v_now, true, v_now)
  on conflict (client_hash) do update
    set tokens = case
          when least(
            p_max_requests::numeric,
            current_counter.tokens
              + greatest(0, extract(epoch from (v_now - current_counter.last_refill_at)))
                * p_max_requests / p_window_seconds
          ) >= 1
            then least(
              p_max_requests::numeric,
              current_counter.tokens
                + greatest(0, extract(epoch from (v_now - current_counter.last_refill_at)))
                  * p_max_requests / p_window_seconds
            ) - 1
          else least(
            p_max_requests::numeric,
            current_counter.tokens
              + greatest(0, extract(epoch from (v_now - current_counter.last_refill_at)))
                * p_max_requests / p_window_seconds
          )
        end,
        last_allowed = least(
          p_max_requests::numeric,
          current_counter.tokens
            + greatest(0, extract(epoch from (v_now - current_counter.last_refill_at)))
              * p_max_requests / p_window_seconds
        ) >= 1,
        last_refill_at = greatest(v_now, current_counter.last_refill_at),
        updated_at = greatest(v_now, current_counter.last_refill_at)
  returning current_counter.tokens, current_counter.last_allowed
       into v_tokens, v_allowed;

  return query
    select v_allowed,
      case when v_allowed then 0
        else greatest(1, ceil((1 - v_tokens) * p_window_seconds / p_max_requests)::integer)
      end;
end;
$$;

revoke all on function public.consume_discovery_rate_limit(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_discovery_rate_limit(text, integer, integer, timestamptz)
  to service_role;
