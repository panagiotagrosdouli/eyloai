-- Intake only. Never deletes users, data, Stripe subscriptions or payment records.
-- Requires verifying the actual EYLO Supabase project and applied migration
-- history before using in staging or production.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'in_review', 'blocked_billing', 'completed', 'declined')),
  requested_at timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Never expose a self-service mutation path through PostgREST. The
-- authenticated endpoint verifies /auth/v1/user and uses the server key.
alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

drop trigger if exists account_deletion_requests_set_updated_date on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_date
before update on public.account_deletion_requests for each row
execute function public.set_updated_date();

comment on table public.account_deletion_requests is
'Server-only account deletion REQUEST intake. No automated deletion or cancellation.';
