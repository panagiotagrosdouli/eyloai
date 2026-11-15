-- Exact legacy column types observed read-only on EYLO; disposable identities only.
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
create function public.set_eylo_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text,full_name text,organization text,country text,research_interests text,skills text,career_goal text,startup_interest text,bio text,user_type text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.projects(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,goal text,description text,milestones text,tasks text,notes text,status text not null default 'planning',eyra_analysis text,twin_report text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
create table public.ideas(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,description text,status text not null default 'active',eyra_notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
create table public.meetings(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,project_id text,project_title text,title text not null,call_type text default 'project_meeting',date text,time text,duration_minutes integer default 60,participants text,agenda text,meeting_link text,notes text,status text not null default 'scheduled',eyra_prep text,transcription text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
create table public.saved_papers(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,authors text,summary text,year integer,source text,url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
create table public.saved_researchers(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,institution text,research_areas text,works_count integer,citation_count integer,profile_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
create table public.saved_opportunities(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,type text,description text,source text,url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
create table public.search_history(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,query text not null,results_summary text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),data jsonb not null default '{}');
do $$ declare t text; owner_column text; begin
 foreach t in array array['profiles','projects','ideas','meetings','saved_papers','saved_researchers','saved_opportunities','search_history'] loop
  owner_column:=case when t='profiles' then 'id' else 'user_id' end;
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy legacy_owner on public.%I for all to authenticated using(auth.uid()=%I) with check(auth.uid()=%I)',t,owner_column,owner_column);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create trigger legacy_timestamp before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;
create trigger legacy_always_timestamp before update on public.projects for each row execute function public.set_eylo_updated_at();
alter table public.projects enable always trigger legacy_always_timestamp;
insert into auth.users(id) values('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000002');
insert into public.profiles(id,full_name,created_at,updated_at) values('90000000-0000-4000-8000-000000000001','Retained profile','2020-01-01T00:00:00Z','2020-02-01T00:00:00Z');
insert into public.projects(id,user_id,title,data,created_at,updated_at) values('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Retained project','{"unknown_extension":{"keep":true}}','2020-01-01T00:00:00Z','2020-02-01T00:00:00Z');
