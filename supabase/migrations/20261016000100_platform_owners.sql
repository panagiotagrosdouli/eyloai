-- Explicit platform owner grants require a verified auth.users UUID.
-- Neither email address nor frontend metadata is sufficient authorization.
create table if not exists public.platform_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;
revoke all on public.platform_owners from public, anon, authenticated;
grant select on public.platform_owners to service_role;
-- Authorized database operator only: verify the existing user's identity
-- before provisioning their auth.users UUID; never expose service role keys.
