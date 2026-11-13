-- Each grant application belongs to one authenticated user's saved notice and
-- one of that same user's projects. The version column supports compare-and-set
-- writes so concurrent tabs cannot silently replace each other's work.
create unique index if not exists saved_opportunities_id_user_unique
  on public.saved_opportunities (id, user_id);
create unique index if not exists projects_id_user_unique
  on public.projects (id, user_id);

create table if not exists public.grant_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_opportunity_id uuid not null,
  project_id uuid not null,
  status text not null default 'researching'
    check (status in ('researching', 'go_no_go', 'drafting', 'internal_review', 'submitted', 'declined', 'awarded')),
  notes text not null default '' check (char_length(notes) <= 20000),
  draft jsonb,
  version integer not null default 1 check (version > 0),
  created_date timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint grant_applications_opportunity_owner_fk
    foreign key (saved_opportunity_id, user_id)
    references public.saved_opportunities (id, user_id) on delete cascade,
  constraint grant_applications_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects (id, user_id) on delete cascade,
  constraint grant_applications_pair_unique unique (user_id, saved_opportunity_id, project_id)
);

create index if not exists grant_applications_user_updated_idx
  on public.grant_applications (user_id, updated_date desc);

alter table public.grant_applications enable row level security;
revoke all on public.grant_applications from anon;
grant select, insert, update, delete on public.grant_applications to authenticated;

drop policy if exists "Users manage own grant applications" on public.grant_applications;
create policy "Users manage own grant applications"
  on public.grant_applications for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists grant_applications_set_updated_date on public.grant_applications;
create trigger grant_applications_set_updated_date
  before update on public.grant_applications
  for each row execute function public.set_updated_date();
