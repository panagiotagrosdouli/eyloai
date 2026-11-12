create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flashcard_decks_owner_updated_idx on public.flashcard_decks(user_id, updated_at desc);
alter table public.flashcard_decks enable row level security;
drop policy if exists "Users manage own flashcard decks" on public.flashcard_decks;
create policy "Users manage own flashcard decks" on public.flashcard_decks
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.flashcard_decks to authenticated;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  question text not null check (char_length(btrim(question)) between 1 and 2000),
  answer text not null check (char_length(btrim(answer)) between 1 and 5000),
  ease_factor numeric(4,2) not null default 2.50 check (ease_factor between 1.30 and 4.00),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  due_at timestamptz not null default now(),
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists flashcards_due_idx on public.flashcards(user_id, deck_id, due_at);
create index if not exists flashcards_note_idx on public.flashcards(user_id, note_id) where note_id is not null;
alter table public.flashcards enable row level security;
drop policy if exists "Users manage own flashcards" on public.flashcards;
create policy "Users manage own flashcards" on public.flashcards
  for all to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.user_id = (select auth.uid()))
    and (note_id is null or exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid())))
  );
grant select, insert, update, delete on public.flashcards to authenticated;

create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null,
  rating smallint not null check (rating between 0 and 5),
  reviewed_at timestamptz not null default now(),
  previous_interval_days integer not null check (previous_interval_days >= 0),
  next_interval_days integer not null check (next_interval_days >= 0),
  ease_factor numeric(4,2) not null check (ease_factor between 1.30 and 4.00),
  foreign key (flashcard_id, user_id) references public.flashcards(id, user_id) on delete cascade
);
create index if not exists flashcard_reviews_owner_recent_idx on public.flashcard_reviews(user_id, reviewed_at desc);
alter table public.flashcard_reviews enable row level security;
drop policy if exists "Users read own flashcard reviews" on public.flashcard_reviews;
create policy "Users read own flashcard reviews" on public.flashcard_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users record own flashcard reviews" on public.flashcard_reviews;
create policy "Users record own flashcard reviews" on public.flashcard_reviews
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = (select auth.uid()))
  );
grant select, insert on public.flashcard_reviews to authenticated;

create or replace function public.touch_flashcard_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;
drop trigger if exists flashcards_touch_updated_at on public.flashcards;
create trigger flashcards_touch_updated_at before update on public.flashcards
for each row execute function public.touch_flashcard_updated_at();
drop trigger if exists flashcard_decks_touch_updated_at on public.flashcard_decks;
create trigger flashcard_decks_touch_updated_at before update on public.flashcard_decks
for each row execute function public.touch_flashcard_updated_at();

create or replace function public.review_flashcard(p_flashcard_id uuid, p_rating smallint, p_expected_revision integer)
returns table (id uuid, due_at timestamptz, interval_days integer, repetitions integer, ease_factor numeric, revision integer, reviewed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  card public.flashcards%rowtype;
  next_interval integer;
  previous_interval integer;
  next_repetitions integer;
  next_ease numeric(4,2);
  review_time timestamptz := now();
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_rating is null or p_rating < 0 or p_rating > 5 then raise exception 'Rating must be from 0 through 5'; end if;
  select * into card from public.flashcards f where f.id = p_flashcard_id and f.user_id = (select auth.uid()) for update;
  if not found then raise exception 'Flashcard not found or access denied'; end if;
  if card.revision is distinct from p_expected_revision then raise exception 'Flashcard changed in another session; reload and retry' using errcode = '40001'; end if;
  previous_interval := card.interval_days;
  next_ease := greatest(1.30, card.ease_factor + 0.10 - (5 - p_rating) * (0.08 + (5 - p_rating) * 0.02));
  if p_rating < 3 then
    next_interval := 1;
    next_repetitions := 0;
  else
    next_repetitions := card.repetitions + 1;
    if card.repetitions = 0 then next_interval := 1;
    elsif card.repetitions = 1 then next_interval := 6;
    else next_interval := greatest(1, round(card.interval_days * next_ease)::integer);
    end if;
  end if;
  update public.flashcards f set ease_factor = next_ease, interval_days = next_interval,
    repetitions = next_repetitions, due_at = review_time + make_interval(days => next_interval)
  where f.id = card.id returning * into card;
  insert into public.flashcard_reviews(user_id, flashcard_id, rating, reviewed_at, previous_interval_days, next_interval_days, ease_factor)
  values ((select auth.uid()), card.id, p_rating, review_time, previous_interval, next_interval, next_ease);
  return query select card.id, card.due_at, card.interval_days, card.repetitions, card.ease_factor, card.revision, review_time;
end;
$$;
revoke all on function public.review_flashcard(uuid, smallint, integer) from public, anon;
grant execute on function public.review_flashcard(uuid, smallint, integer) to authenticated;
