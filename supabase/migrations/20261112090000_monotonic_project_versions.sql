-- REVIEW-ONLY MIGRATION: requires approved matching Supabase project and staging validation.
-- Projects use updated_date as an optimistic compare-and-set token. The original
-- public.set_updated_date() uses now(), the *transaction start timestamp*, and
-- therefore does not always generate a new value after multiple writes in one
-- transaction. Make only PROJECTS monotonic without modifying other entity triggers.
--
-- This migration has not been applied to any EYLO environment by this PR.
create or replace function public.set_project_updated_date_monotonic()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The row lock serializes competing UPDATEs on the same project.
  -- clock_timestamp() samples the actual time rather than transaction start.
  -- GREATEST ensures strict increase even if the clock is coarse/backward.
  new.updated_date := greatest(
    pg_catalog.clock_timestamp(),
    old.updated_date + interval '1 microsecond'
  );
  return new;
end;
$$;

-- Replace only the project trigger; profiles and other generic entities retain
-- the original function until separately reviewed.
drop trigger if exists projects_set_updated_date on public.projects;
create trigger projects_set_updated_date
before update on public.projects
for each row execute function public.set_project_updated_date_monotonic();
