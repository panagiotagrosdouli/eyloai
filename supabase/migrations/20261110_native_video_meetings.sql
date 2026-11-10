-- Native EYLO meeting invitation and membership records.
-- Apply through the project's reviewed Supabase migration workflow; this file
-- is not applied automatically to production.
create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('host', 'participant')),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  invite_token_hash text,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_date timestamptz not null default timezone('utc', now()),
  constraint meeting_participants_meeting_email_unique unique (meeting_id, invited_email),
  constraint meeting_participants_token_hash_format check (invite_token_hash is null or invite_token_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists meeting_participants_user_meeting_idx
  on public.meeting_participants(user_id, meeting_id) where status = 'accepted';
create index if not exists meeting_participants_owner_meeting_idx
  on public.meeting_participants(owner_user_id, meeting_id);
create unique index if not exists meeting_participants_invite_token_idx
  on public.meeting_participants(invite_token_hash) where invite_token_hash is not null;

alter table public.meeting_participants enable row level security;
revoke all on public.meeting_participants from anon;
-- Keep invitation writes behind the authenticated server endpoint. Browser
-- clients must not be able to set status=accepted or bind a user_id directly.
grant select on public.meeting_participants to authenticated;

drop policy if exists "Meeting owners and invited members read participants" on public.meeting_participants;
create policy "Meeting owners and invited members read participants"
  on public.meeting_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_participants.meeting_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "Meeting owners manage participants" on public.meeting_participants;

drop trigger if exists meeting_participants_set_updated_date on public.meeting_participants;
create trigger meeting_participants_set_updated_date
  before update on public.meeting_participants
  for each row execute function public.set_updated_date();
