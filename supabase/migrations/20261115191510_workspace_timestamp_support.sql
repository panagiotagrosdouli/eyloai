-- Shared trigger dependency for the already-reviewed canonical workspace tables.
-- The observed live legacy database did not have this function.
create or replace function public.set_updated_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_date = timezone('utc', now());
  return new;
end;
$$;
revoke all on function public.set_updated_date() from public,anon;
grant execute on function public.set_updated_date() to authenticated,service_role;
