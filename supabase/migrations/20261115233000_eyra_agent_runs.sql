-- EYRA agent execution ledger. Canonical local replay only.
-- Not approved for remote application without independently validated staging.
-- The service backend authenticates each user and is the sole writer. Authenticated
-- clients can read only their own ledger rows; there are no client write policies.
create table public.eyra_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  input_preview text not null check (char_length(input_preview) between 1 and 300),
  status text not null default 'running'
    check (status in ('running','completed','failed','partial','cancelled','needs_review')),
  response_text text not null default '' check (char_length(response_text) <= 16000),
  action_summary jsonb not null default '[]'::jsonb
    check (jsonb_typeof(action_summary) = 'array'
      and jsonb_array_length(action_summary) <= 8
      and octet_length(action_summary::text) <= 65536),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, request_id),
  unique (id, user_id),
  check ((status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null))
);

create index eyra_agent_runs_owner_recent
  on public.eyra_agent_runs (user_id, started_at desc, id desc);

create table public.eyra_agent_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  user_id uuid not null,
  call_id text not null check (char_length(call_id) between 1 and 200),
  tool_name text not null check (char_length(tool_name) between 1 and 100),
  arguments_hash text not null check (arguments_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'started'
    check (status in ('started','succeeded','failed','needs_review')),
  outcome jsonb not null default '{}'::jsonb
    check (jsonb_typeof(outcome) = 'object' and octet_length(outcome::text) <= 32768),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint eyra_agent_action_owner_fk
    foreign key (run_id,user_id) references public.eyra_agent_runs(id,user_id) on delete cascade,
  unique (run_id,call_id),
  check ((status = 'started' and finished_at is null)
    or (status <> 'started' and finished_at is not null))
);

create index eyra_agent_actions_owner_run
  on public.eyra_agent_actions (user_id,run_id,started_at,id);

alter table public.eyra_agent_runs enable row level security;
alter table public.eyra_agent_actions enable row level security;

create policy eyra_agent_runs_owner_read on public.eyra_agent_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy eyra_agent_actions_owner_read on public.eyra_agent_actions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.eyra_agent_runs,public.eyra_agent_actions from public,anon,authenticated;
grant select on public.eyra_agent_runs,public.eyra_agent_actions to authenticated;
grant select,insert,update,delete on public.eyra_agent_runs,public.eyra_agent_actions to service_role;
