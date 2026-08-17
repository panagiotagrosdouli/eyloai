-- Applying this migration opts production watchlists into a daily external
-- source check. Each active watchlist query is sent to OpenAlex or Grants.gov.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Private hash used by the scheduled Edge Function. The plaintext token stays
-- encrypted in Vault and is read only by the database scheduler.
create table if not exists public.system_secrets (
  name text primary key,
  secret_hash text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.system_secrets enable row level security;
revoke all on public.system_secrets from anon, authenticated;
grant select, insert, update, delete on public.system_secrets to service_role;

do $$
declare
  monitor_token text;
begin
  select decrypted_secret
    into monitor_token
    from vault.decrypted_secrets
   where name = 'eylo_monitor_cron_token'
   limit 1;

  if monitor_token is null then
    monitor_token := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      monitor_token,
      'eylo_monitor_cron_token',
      'Credential for the EYLO scheduled monitoring Edge Function'
    );
  end if;

  insert into public.system_secrets (name, secret_hash, updated_at)
  values (
    'monitor_cron',
    encode(extensions.digest(monitor_token, 'sha256'), 'hex'),
    timezone('utc', now())
  )
  on conflict (name) do update set
    secret_hash = excluded.secret_hash,
    updated_at = excluded.updated_at;
end $$;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'eylo-scheduled-monitoring';

select cron.schedule(
  'eylo-scheduled-monitoring',
  '0 8 * * *',
  $cron$
    select net.http_post(
      url := 'https://kbzjngpzxpniaumlupaa.supabase.co/functions/v1/scheduled-monitoring',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-eylo-cron-token', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'eylo_monitor_cron_token'
           limit 1
        )
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $cron$
);
