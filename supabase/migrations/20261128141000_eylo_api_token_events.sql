-- Owner-readable audit trail for personal developer-token creation/revocation.
-- Secrets and token hashes are deliberately excluded from event rows.
create table public.eylo_api_token_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid not null,
  token_name text not null check (length(token_name) between 1 and 100),
  action text not null check (action in ('created', 'revoked')),
  created_at timestamptz not null default now()
);

create index eylo_api_token_events_owner_time_idx
  on public.eylo_api_token_events (user_id, created_at desc, id desc);

alter table public.eylo_api_token_events enable row level security;
create policy token_events_read on public.eylo_api_token_events
  for select to authenticated using (user_id = auth.uid());
create policy token_events_account_deletion_lock on public.eylo_api_token_events
  as restrictive for all to authenticated
  using ((select private.eylo_account_active()))
  with check ((select private.eylo_account_active()));

revoke all on public.eylo_api_token_events from public, anon, authenticated, service_role;
grant select on public.eylo_api_token_events to authenticated, service_role;

create function private.log_eylo_api_token_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.eylo_api_token_events (user_id, token_id, token_name, action)
    values (new.user_id, new.id, new.name, 'created');
  elsif old.revoked_at is null and new.revoked_at is not null then
    insert into public.eylo_api_token_events (user_id, token_id, token_name, action)
    values (new.user_id, new.id, new.name, 'revoked');
  end if;
  return new;
end;
$$;
revoke all on function private.log_eylo_api_token_event() from public, anon, authenticated, service_role;

create trigger eylo_api_token_event_insert
  after insert on public.eylo_api_tokens
  for each row execute function private.log_eylo_api_token_event();
create trigger eylo_api_token_event_revoke
  after update of revoked_at on public.eylo_api_tokens
  for each row when (old.revoked_at is null and new.revoked_at is not null)
  execute function private.log_eylo_api_token_event();

comment on table public.eylo_api_token_events is
  'Owner-scoped audit events for personal developer tokens; never stores credentials or hashes.';
