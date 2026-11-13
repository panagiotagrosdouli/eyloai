-- EYRA durable conversation contract (proposal only; do not apply to production).
-- Conversation rows and messages are private, retained until an explicit owner
-- deletion or account cascade. No background TTL or silent expiry is enabled.
create table public.eyra_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 180),
  version bigint not null default 1 check (version >= 1),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (id, user_id)
);

create index eyra_conversations_owner_recent_idx
  on public.eyra_conversations (user_id, updated_date desc, id desc);

-- Prevent owner reassignment, timestamps rewritten by clients, or bypassing
-- optimistic version advancement. Clients update with WHERE version = expected.
create function public.eyra_conversation_version_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.created_date is distinct from old.created_date then
    raise exception 'EYRA conversation identity is immutable' using errcode = '23514';
  end if;
  new.version := old.version + 1;
  new.updated_date := timezone('utc', now());
  return new;
end;
$$;

create trigger eyra_conversation_version_guard_trigger
before update on public.eyra_conversations for each row
execute function public.eyra_conversation_version_guard();

create table public.eyra_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null,
  sequence_number bigint not null check (sequence_number between 1 and 100000),
  role text not null check (role in ('user', 'assistant', 'tool')),
  -- Deliberately narrow: content is a text-only JSON object, not arbitrary
  -- upstream provider output or tool diagnostics.
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and content ? 'text'
    and jsonb_typeof(content -> 'text') = 'string'
    and char_length(content ->> 'text') between 1 and 16000
    and jsonb_object_length(content) = 1
    and octet_length(content::text) <= 65536
  ),
  created_date timestamptz not null default now(),
  constraint eyra_messages_parent_owner_fkey
    foreign key (conversation_id, user_id)
    references public.eyra_conversations (id, user_id)
    on delete cascade,
  unique (conversation_id, sequence_number)
);

create index eyra_messages_owner_order_idx
  on public.eyra_messages (user_id, conversation_id, sequence_number, id);

alter table public.eyra_conversations enable row level security;
alter table public.eyra_messages enable row level security;

create policy eyra_conversations_owner_select on public.eyra_conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy eyra_conversations_owner_insert on public.eyra_conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy eyra_conversations_owner_update on public.eyra_conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy eyra_conversations_owner_delete on public.eyra_conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy eyra_messages_owner_select on public.eyra_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy eyra_messages_owner_insert on public.eyra_messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.eyra_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

-- Avoid implicit grants to unauthenticated users. Keep message records
-- append-only: owner deletes a conversation to cascade its messages.
revoke all on public.eyra_conversations from public, anon, service_role;
revoke all on public.eyra_messages from public, anon, service_role;
grant select, insert, update, delete on public.eyra_conversations to authenticated;
grant select, insert on public.eyra_messages to authenticated;

comment on table public.eyra_conversations is
  'Private EYRA threads. Retained until explicit owner deletion or auth user deletion; no automated expiry.';
comment on table public.eyra_messages is
  'Append-only text messages. Cascade-deleted with parent. No provider credentials, tokens or raw diagnostics.';
