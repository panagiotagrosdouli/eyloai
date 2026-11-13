-- Stable caller UUID makes retries atomic and idempotent under the existing owner RLS.
drop function public.save_eyra_conversation_snapshot(text,jsonb);
create function public.save_eyra_conversation_snapshot(p_title text, p_messages jsonb, p_snapshot_id uuid default gen_random_uuid())
returns public.eyra_conversations
language plpgsql security invoker set search_path = '' as $$
declare
  thread public.eyra_conversations;
  item jsonb;
  sequence bigint := 0;
  text_size bigint := 0;
  created boolean;
  existing_messages jsonb;
  expected_messages jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages) not between 1 and 30
     or octet_length(p_messages::text) > 524288 then
    raise exception 'Invalid conversation snapshot' using errcode = '22023';
  end if;
  insert into public.eyra_conversations(id,user_id,title) values(p_snapshot_id,auth.uid(),p_title)
  -- The parent has both primary-key and composite owner/FK unique constraints.
  -- Concurrent speculative inserts may collide with either index.
  on conflict do nothing returning * into thread;
  created := found;
  if not created then
    select * into thread from public.eyra_conversations where id=p_snapshot_id and user_id=auth.uid() for update;
    if not found then raise exception 'Snapshot unavailable' using errcode='42501'; end if;
    select jsonb_agg(jsonb_build_object('role',role,'text',content->>'text','sources',sources) order by sequence_number)
    into existing_messages from public.eyra_messages where conversation_id=p_snapshot_id and user_id=auth.uid();
    select jsonb_agg(jsonb_build_object('role',value->>'role','text',value->>'text','sources',coalesce(value->'sources','[]'::jsonb)) order by ordinality)
    into expected_messages from jsonb_array_elements(p_messages) with ordinality;
    if thread.title is distinct from p_title or existing_messages is distinct from expected_messages then
      raise exception 'Snapshot ID conflicts with existing content' using errcode='23505';
    end if;
    return thread;
  end if;
  for item in select value from jsonb_array_elements(p_messages) loop
    if item->>'role' not in ('user','assistant') or item->>'role' is null then
      raise exception 'Invalid message role' using errcode = '22023';
    end if;
    text_size := text_size + char_length(item->>'text');
    if text_size > 120000 then raise exception 'Conversation exceeds budget' using errcode = '22023'; end if;
    sequence := sequence + 1;
    insert into public.eyra_messages(conversation_id,user_id,sequence_number,role,content,sources)
    values(thread.id,auth.uid(),sequence,item->>'role',jsonb_build_object('text',item->>'text'),coalesce(item->'sources','[]'::jsonb));
  end loop;
  return thread;
end;
$$;
revoke all on function public.save_eyra_conversation_snapshot(text,jsonb,uuid) from public,anon,service_role;
grant execute on function public.save_eyra_conversation_snapshot(text,jsonb,uuid) to authenticated;
