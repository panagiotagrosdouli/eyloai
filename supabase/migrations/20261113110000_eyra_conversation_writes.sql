-- Add owner-invoker write functions to the existing EYRA schema.
-- Requires 20261113090000_eyra_conversations.sql. No new tables.
-- Calls are atomic PostgreSQL transactions. Never execute as service_role.
create or replace function public.eyra_create_conversation(
  p_id uuid,
  p_title text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.eyra_conversations%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_id is null or p_title is null or char_length(p_title) not between 1 and 180 then
    raise exception 'Invalid conversation' using errcode = '22023';
  end if;

  insert into public.eyra_conversations (id, user_id, title)
  values (p_id, v_user, p_title)
  on conflict (id) do nothing;

  select * into v_row
  from public.eyra_conversations
  where id = p_id and user_id = v_user;

  if not found then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if v_row.title is distinct from p_title then
    raise exception 'Conversation idempotency conflict' using errcode = '23505';
  end if;
  return jsonb_build_object(
    'id', v_row.id, 'title', v_row.title, 'version', v_row.version,
    'created_date', v_row.created_date, 'updated_date', v_row.updated_date
  );
end
$$;

create or replace function public.eyra_append_message(
  p_conversation_id uuid,
  p_message_id uuid,
  p_role text,
  p_text text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_parent public.eyra_conversations%rowtype;
  v_existing public.eyra_messages%rowtype;
  v_row public.eyra_messages%rowtype;
  v_sequence bigint;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_conversation_id is null or p_message_id is null
     or p_role is null or p_role not in ('user', 'assistant', 'tool')
     or p_text is null or char_length(p_text) not between 1 and 16000
     or octet_length(jsonb_build_object('text', p_text)::text) > 65536 then
    raise exception 'Invalid EYRA message' using errcode = '22023';
  end if;

  -- Owner-scoped row lock serializes appenders for one conversation.
  -- A retry with the same message UUID returns the original persisted row.
  select * into v_parent from public.eyra_conversations
  where id = p_conversation_id and user_id = v_user for update;
  if not found then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.eyra_messages
  where id = p_message_id and conversation_id = p_conversation_id
    and user_id = v_user;
  if found then
    if v_existing.role is distinct from p_role
       or v_existing.content is distinct from jsonb_build_object('text', p_text) then
      raise exception 'Message idempotency conflict' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'id', v_existing.id, 'conversation_id', v_existing.conversation_id,
      'sequence_number', v_existing.sequence_number, 'role', v_existing.role,
      'content', v_existing.content, 'created_date', v_existing.created_date
    );
  end if;

  select coalesce(max(sequence_number), 0) + 1 into v_sequence
  from public.eyra_messages where conversation_id = p_conversation_id
    and user_id = v_user;
  if v_sequence > 100000 then
    raise exception 'Conversation is full' using errcode = '22023';
  end if;

  insert into public.eyra_messages (
    id, conversation_id, user_id, sequence_number, role, content
  ) values (
    p_message_id, p_conversation_id, v_user, v_sequence,
    p_role, jsonb_build_object('text', p_text)
  ) returning * into v_row;

  -- Refresh order for conversation lists; increments optimistic version.
  update public.eyra_conversations set updated_date = timezone('utc', now())
    where id = p_conversation_id and user_id = v_user;

  return jsonb_build_object(
    'id', v_row.id, 'conversation_id', v_row.conversation_id,
    'sequence_number', v_row.sequence_number, 'role', v_row.role,
    'content', v_row.content, 'created_date', v_row.created_date
  );
end
$$;

revoke all on function public.eyra_create_conversation(uuid, text) from public, anon, service_role;
revoke all on function public.eyra_append_message(uuid, uuid, text, text) from public, anon, service_role;
grant execute on function public.eyra_create_conversation(uuid, text) to authenticated;
grant execute on function public.eyra_append_message(uuid, uuid, text, text) to authenticated;

comment on function public.eyra_create_conversation(uuid, text) is
  'Idempotent owner-bound EYRA conversation creation. Caller supplies UUID.';
comment on function public.eyra_append_message(uuid, uuid, text, text) is
  'Atomic owner-bound idempotent EYRA append with parent row lock and allocated sequence.';
