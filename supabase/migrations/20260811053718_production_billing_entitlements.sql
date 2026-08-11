-- Server-controlled Stripe entitlements. These records are intentionally
-- separate from public.profile fields that users may update themselves.

create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'founder', 'institution')),
  subscription_status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_renewal_at timestamptz,
  last_stripe_event_created_at bigint not null default 0,
  last_stripe_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_entitlements_stripe_customer_uidx
  on public.billing_entitlements (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists billing_entitlements_stripe_subscription_uidx
  on public.billing_entitlements (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at bigint not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.eyra_usage_actions (
  action_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_month text not null,
  created_at timestamptz not null default now()
);

create index if not exists eyra_usage_actions_user_month_idx
  on public.eyra_usage_actions (user_id, usage_month);

alter table public.billing_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.eyra_usage_actions enable row level security;

revoke all on table public.billing_entitlements from anon, authenticated;
revoke all on table public.stripe_webhook_events from anon, authenticated;
revoke all on table public.eyra_usage_actions from anon, authenticated;
grant select, insert, update, delete on table public.billing_entitlements to service_role;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
grant select, insert, delete on table public.eyra_usage_actions to service_role;

create or replace function public.apply_billing_entitlement(
  p_event_id text,
  p_event_type text,
  p_event_created_at bigint,
  p_user_id uuid,
  p_plan text,
  p_subscription_status text,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_subscription_renewal_at timestamptz default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_events integer;
begin
  if p_plan not in ('free', 'pro', 'founder', 'institution') then
    raise exception 'Invalid billing plan';
  end if;

  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    event_created_at
  ) values (
    p_event_id,
    p_event_type,
    p_event_created_at
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_events = row_count;
  if inserted_events = 0 then
    return false;
  end if;

  insert into public.billing_entitlements (
    user_id,
    plan,
    subscription_status,
    stripe_customer_id,
    stripe_subscription_id,
    subscription_renewal_at,
    last_stripe_event_created_at,
    last_stripe_event_id,
    updated_at
  ) values (
    p_user_id,
    p_plan,
    coalesce(nullif(p_subscription_status, ''), 'unknown'),
    nullif(p_stripe_customer_id, ''),
    nullif(p_stripe_subscription_id, ''),
    p_subscription_renewal_at,
    p_event_created_at,
    p_event_id,
    now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    subscription_status = excluded.subscription_status,
    stripe_customer_id = coalesce(
      excluded.stripe_customer_id,
      public.billing_entitlements.stripe_customer_id
    ),
    stripe_subscription_id = coalesce(
      excluded.stripe_subscription_id,
      public.billing_entitlements.stripe_subscription_id
    ),
    subscription_renewal_at = excluded.subscription_renewal_at,
    last_stripe_event_created_at = excluded.last_stripe_event_created_at,
    last_stripe_event_id = excluded.last_stripe_event_id,
    updated_at = now()
  where excluded.last_stripe_event_created_at
    >= public.billing_entitlements.last_stripe_event_created_at;

  return true;
end;
$$;

revoke all on function public.apply_billing_entitlement(
  text,
  text,
  bigint,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_billing_entitlement(
  text,
  text,
  bigint,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) to service_role;

create or replace function public.reserve_eyra_usage(
  p_action_id uuid,
  p_user_id uuid,
  p_usage_month text,
  p_limit integer default null
)
returns table (allowed boolean, used integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_usage integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_usage_month, 0)
  );

  select count(*)::integer
    into current_usage
    from public.eyra_usage_actions
   where user_id = p_user_id
     and usage_month = p_usage_month;

  if p_limit is not null and current_usage >= p_limit then
    return query select false, current_usage;
    return;
  end if;

  insert into public.eyra_usage_actions (action_id, user_id, usage_month)
  values (p_action_id, p_user_id, p_usage_month)
  on conflict (action_id) do nothing;

  if found then
    current_usage := current_usage + 1;
  end if;

  return query select true, current_usage;
end;
$$;

create or replace function public.release_eyra_usage(p_action_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with deleted as (
    delete from public.eyra_usage_actions
    where action_id = p_action_id
    returning 1
  )
  select exists(select 1 from deleted);
$$;

revoke all on function public.reserve_eyra_usage(uuid, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.release_eyra_usage(uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_eyra_usage(uuid, uuid, text, integer)
  to service_role;
grant execute on function public.release_eyra_usage(uuid)
  to service_role;
