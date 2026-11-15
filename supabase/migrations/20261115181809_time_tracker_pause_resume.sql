-- Additive only: legacy entries have no pauses and revision zero.
alter table public.time_entries
  add column if not exists pause_intervals jsonb not null default '[]'::jsonb,
  add column if not exists timer_revision bigint not null default 0 check (timer_revision >= 0);

create or replace function public.valid_timer_pauses(pauses jsonb, timer_start timestamptz, timer_end timestamptz)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare item jsonb; pause_start timestamptz; pause_end timestamptz;
  previous_end timestamptz := timer_start; position integer := 0; count_pauses integer;
begin
  if jsonb_typeof(pauses) is distinct from 'array' then return false; end if;
  count_pauses := jsonb_array_length(pauses);
  if count_pauses > 1000 then return false; end if;
  for item in select value from jsonb_array_elements(pauses) loop
    position := position + 1;
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'started_at') is distinct from 'string'
      or not (item ? 'ended_at')
      or (item->>'started_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return false; end if;
    pause_start := (item->>'started_at')::timestamptz;
    if not isfinite(pause_start) or pause_start < previous_end then return false; end if;
    if item->'ended_at' = 'null'::jsonb then
      if position <> count_pauses or timer_end is not null then return false; end if;
      pause_end := null;
    else
      if jsonb_typeof(item->'ended_at') is distinct from 'string'
        or (item->>'ended_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return false; end if;
      pause_end := (item->>'ended_at')::timestamptz;
      if not isfinite(pause_end) or pause_end < pause_start then return false; end if;
    end if;
    if timer_end is not null and (pause_start > timer_end or pause_end > timer_end) then return false; end if;
    previous_end := pause_end;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.valid_timer_pauses(jsonb,timestamptz,timestamptz) from public, anon;
grant execute on function public.valid_timer_pauses(jsonb,timestamptz,timestamptz) to authenticated, service_role;
alter table public.time_entries add constraint time_entries_valid_pauses
  check (public.valid_timer_pauses(pause_intervals, started_at, ended_at));

-- Revisions also advance on direct owner edits, so an older browser cannot
-- transition a timer whose description, links or timing has since changed.
create or replace function public.advance_timer_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.timer_revision := old.timer_revision + 1; return new; end;
$$;
create trigger time_entries_advance_revision before update on public.time_entries
for each row execute function public.advance_timer_revision();

create or replace function public.transition_time_entry(p_entry_id uuid, p_action text, p_expected_revision bigint)
returns public.time_entries language plpgsql security invoker set search_path = '' as $$
declare entry public.time_entries; pauses jsonb; last_pause jsonb;
  paused boolean; transition_at timestamptz; last_index integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('pause','resume','stop') or p_expected_revision is null then
    raise exception 'Invalid timer transition' using errcode = '22023';
  end if;
  select * into entry from public.time_entries
    where id = p_entry_id and user_id = auth.uid() for update;
  if not found then raise exception 'Timer not found or access denied' using errcode = '42501'; end if;
  if entry.timer_revision <> p_expected_revision then
    raise exception 'Timer changed in another tab. Reload before retrying.' using errcode = '40001';
  end if;
  if entry.ended_at is not null then raise exception 'Timer is already stopped' using errcode = '22023'; end if;
  transition_at := clock_timestamp();
  if transition_at <= entry.started_at then raise exception 'Timer start must precede this action' using errcode = '22023'; end if;
  pauses := entry.pause_intervals;
  last_index := jsonb_array_length(pauses) - 1;
  last_pause := pauses->last_index;
  paused := coalesce(last_pause->'ended_at' = 'null'::jsonb, false);
  if p_action = 'pause' then
    if paused then return entry; end if;
    if jsonb_array_length(pauses) >= 1000 then raise exception 'Timer pause limit reached. Stop this timer and start a new entry.' using errcode = '22023'; end if;
    pauses := pauses || jsonb_build_array(jsonb_build_object('started_at',transition_at,'ended_at',null));
  elsif p_action = 'resume' then
    if not paused then return entry; end if;
    if transition_at < (last_pause->>'started_at')::timestamptz then raise exception 'Pause begins in the future' using errcode = '22023'; end if;
    pauses := jsonb_set(pauses, array[last_index::text,'ended_at'], to_jsonb(transition_at));
  elsif paused then
    if transition_at < (last_pause->>'started_at')::timestamptz then raise exception 'Pause begins in the future' using errcode = '22023'; end if;
    pauses := jsonb_set(pauses, array[last_index::text,'ended_at'], to_jsonb(transition_at));
  end if;
  update public.time_entries set pause_intervals = pauses,
    ended_at = case when p_action = 'stop' then transition_at else null end
    where id = entry.id and user_id = auth.uid() returning * into entry;
  return entry;
end;
$$;
revoke all on function public.transition_time_entry(uuid,text,bigint) from public, anon;
grant execute on function public.transition_time_entry(uuid,text,bigint) to authenticated;
