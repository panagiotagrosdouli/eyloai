-- Enforce one discovery per user and external source record, even when
-- multiple cron workers overlap. Existing historical duplicates are retained:
-- this migration deliberately fails if duplicate keys already exist so an
-- operator can review them before any data is deleted.
--
-- IMPORTANT: Apply only to the verified EYLO Supabase project, after reviewing
-- duplicate rows with:
-- select user_id, data ->> 'external_id' as external_id, count(*)
-- from public.monitoring_discoveries
-- where nullif(data ->> 'external_id', '') is not null
-- group by 1, 2 having count(*) > 1;
--
-- Legacy records may use externalId; this index intentionally covers both.
create unique index if not exists monitoring_discoveries_user_source_unique
  on public.monitoring_discoveries (
    user_id,
    (coalesce(nullif(data ->> 'external_id', ''), nullif(data ->> 'externalId', '')))
  )
  where coalesce(nullif(data ->> 'external_id', ''), nullif(data ->> 'externalId', '')) is not null;
