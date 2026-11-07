-- Voluntary public research collaboration listings. No private CV or account email is exposed.
create table if not exists public.collaboration_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 8 and 160),
  field text not null check (char_length(trim(field)) between 2 and 120),
  description text not null check (char_length(trim(description)) between 30 and 3000),
  skills text[] not null default '{}',
  opportunity_type text not null check (opportunity_type in ('research','phd','job','paper','grant','other')),
  work_mode text not null default 'flexible' check (work_mode in ('remote','onsite','hybrid','flexible')),
  institution text not null default '',
  location text not null default '',
  contact_email text not null check (char_length(contact_email) between 5 and 254 and contact_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
  compensation text not null default 'unspecified' check (compensation in ('paid','unpaid','unspecified')),
  expires_at date,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collaboration_skills_limit check (cardinality(skills) <= 12),
  constraint collaboration_institution_limit check (char_length(institution) <= 140),
  constraint collaboration_location_limit check (char_length(location) <= 140)
);
create index if not exists collaboration_posts_live_idx on public.collaboration_posts (created_at desc) where status = 'open';
create index if not exists collaboration_posts_owner_idx on public.collaboration_posts (owner_id, created_at desc);
alter table public.collaboration_posts enable row level security;
drop policy if exists "Read open collaboration postings" on public.collaboration_posts;
create policy "Read open collaboration postings" on public.collaboration_posts for select to authenticated
using (status = 'open' and (expires_at is null or expires_at >= current_date) or owner_id = (select auth.uid()));
drop policy if exists "Create own collaboration postings" on public.collaboration_posts;
create policy "Create own collaboration postings" on public.collaboration_posts for insert to authenticated
with check (owner_id = (select auth.uid()));
drop policy if exists "Update own collaboration postings" on public.collaboration_posts;
create policy "Update own collaboration postings" on public.collaboration_posts for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Delete own collaboration postings" on public.collaboration_posts;
create policy "Delete own collaboration postings" on public.collaboration_posts for delete to authenticated
using (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.collaboration_posts to authenticated;
-- Contact details are voluntary and visible to authenticated members. Do not post private data without consent.
