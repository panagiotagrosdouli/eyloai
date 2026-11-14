-- Proposal only: independently verified staging before any remote execution.
-- Private lifecycle state is not a competing user-data or AI memory store.
create table private.account_deletion_jobs (
 id uuid primary key, user_id uuid unique, phase text not null default 'queued' check(phase in('queued','storage','auth','complete')),
 objects_removed bigint not null default 0 check(objects_removed>=0),
 lease_token uuid, lease_until timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.account_deletion_jobs enable row level security;
revoke all on private.account_deletion_jobs from public,anon,authenticated,service_role;
-- user_id intentionally survives Auth deletion until completion verification,
-- then is cleared. An interrupted job remains resumable; no password/email stored.
create function private.eylo_account_active() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and(u.banned_until is null or u.banned_until<=now()))
 and not exists(select 1 from private.account_deletion_jobs j where j.user_id=auth.uid())
$$;
revoke all on function private.eylo_account_active() from public,anon;
grant execute on function private.eylo_account_active() to authenticated;
-- Restrictive policies also stop stale JWT writes, not just refreshed sessions.
do $$declare t text;begin foreach t in array array['profiles','projects','ideas','meetings','saved_papers','saved_researchers','saved_opportunities','search_history','watchlists','monitoring_discoveries','notifications','notes','note_versions','life_tasks','life_goals','calendar_events','study_flashcard_decks','activity_events','time_entries','quizzes','quiz_questions','quiz_attempts','learning_courses','learning_lessons','learning_enrollments','learning_lesson_progress','eylo_files','eylo_file_versions','eyra_conversations','eyra_messages','grant_applications','eylo_directory','eylo_teams','eylo_team_invites','eylo_team_members','eylo_connections','eylo_community_posts','eylo_peer_submissions','eylo_peer_reviews','eylo_feedback','eylo_api_tokens','billing_entitlements','eyra_usage_actions'] loop
 execute format('create policy account_deletion_lock on public.%I as restrictive for all to authenticated using((select private.eylo_account_active())) with check((select private.eylo_account_active()))',t);
end loop;end$$;
create policy account_deletion_lock on storage.objects as restrictive for all to authenticated using((select private.eylo_account_active())) with check((select private.eylo_account_active()));
-- Deleting a reviewer must not cascade-delete another author's manuscript.
alter table public.eylo_peer_submissions drop constraint eylo_peer_submissions_reviewer_id_fkey;
alter table public.eylo_peer_submissions alter column reviewer_id drop not null;
alter table public.eylo_peer_submissions add constraint eylo_peer_submissions_reviewer_id_fkey foreign key(reviewer_id) references auth.users(id) on delete set null;
-- Existing INSERT policy still requires an accepted non-null connection.
create function public.start_account_deletion(p_user_id uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.account_deletion_jobs;bill public.billing_entitlements;begin
 perform 1 from auth.users where id=p_user_id for update;
 if not found then raise exception 'Account unavailable' using errcode='42501';end if;
 select * into bill from public.billing_entitlements where user_id=p_user_id for update;
 if bill.stripe_customer_id is not null or bill.stripe_subscription_id is not null or bill.plan<>'free' then raise exception 'BILLING_REVIEW_REQUIRED';end if;
 insert into private.account_deletion_jobs(id,user_id) values(p_id,p_user_id) on conflict(user_id) do nothing;
 select * into job from private.account_deletion_jobs where user_id=p_user_id;
 if job.id is null then raise exception 'Deletion identity conflict';end if;
 delete from auth.sessions where user_id=p_user_id;
 return jsonb_build_object('id',job.id,'phase',job.phase);
end$$;
create function public.claim_account_deletion(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.account_deletion_jobs;begin
 update private.account_deletion_jobs set lease_token=p_lease,lease_until=now()+interval '60 seconds',updated_at=now()
 where id=p_id and phase<>'complete' and(lease_until is null or lease_until<now()) returning * into job;
 if job.id is null then
  select * into job from private.account_deletion_jobs where id=p_id and phase='complete';
  if job.id is null then return null;end if;
 end if;
 return jsonb_build_object('id',job.id,'user_id',job.user_id,'phase',job.phase,'objects_removed',job.objects_removed);
end$$;
create function private.deletion_owns_object(o storage.objects,target uuid) returns boolean language sql immutable set search_path='' as $$
 select coalesce(nullif(to_jsonb(o)->>'owner_id',''),nullif(to_jsonb(o)->>'owner',''),'')=target::text
 or(o.bucket_id='eylo-files' and split_part(o.name,'/',1)=target::text
 and coalesce(nullif(to_jsonb(o)->>'owner_id',''),nullif(to_jsonb(o)->>'owner',''),'') in('',target::text))
$$;
revoke all on function private.deletion_owns_object(storage.objects,uuid) from public,anon,authenticated;
create function public.account_deletion_storage_batch(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;items jsonb;begin
 select user_id into target from private.account_deletion_jobs where id=p_id and lease_token=p_lease and lease_until>now() and phase<>'complete';
 if target is null then raise exception 'Deletion lease unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)),'[]'::jsonb) into items from
 (select o.bucket_id,o.name from storage.objects o where private.deletion_owns_object(o,target) order by bucket_id,name limit 100) rows;
 return items;
end$$;
create function public.progress_account_deletion(p_id uuid,p_lease uuid,p_removed integer,p_phase text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;begin
 if p_removed not between 0 and 100 or p_phase not in('storage','auth') then raise exception 'Invalid deletion progress';end if;
 select user_id into target from private.account_deletion_jobs where id=p_id and lease_token=p_lease and lease_until>now() and phase<>'complete' for update;
 if target is null then raise exception 'Deletion lease unavailable' using errcode='42501';end if;
 if p_phase='auth' and exists(select 1 from storage.objects o where private.deletion_owns_object(o,target)) then raise exception 'Storage deletion incomplete';end if;
 update private.account_deletion_jobs set phase=p_phase,objects_removed=objects_removed+p_removed,updated_at=now() where id=p_id;
end$$;
create function public.finish_account_deletion(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;t text;remaining bigint;begin
 select user_id into target from private.account_deletion_jobs where id=p_id and lease_token=p_lease and lease_until>now() and phase='auth' for update;
 if target is null then raise exception 'Deletion lease unavailable' using errcode='42501';end if;
 if exists(select 1 from auth.users where id=target) or exists(select 1 from auth.sessions where user_id=target)
 or exists(select 1 from storage.objects o where private.deletion_owns_object(o,target)) then raise exception 'Account deletion incomplete';end if;
 foreach t in array array['profiles','projects','ideas','meetings','saved_papers','saved_researchers','saved_opportunities','search_history','watchlists','monitoring_discoveries','notifications','notes','note_versions','life_tasks','life_goals','calendar_events','study_flashcard_decks','activity_events','time_entries','quizzes','quiz_questions','quiz_attempts','learning_courses','learning_lessons','learning_enrollments','learning_lesson_progress','eylo_files','eylo_file_versions','eyra_conversations','eyra_messages','grant_applications','eylo_directory','eylo_teams','eylo_team_invites','eylo_team_members','eylo_connections','eylo_community_posts','eylo_peer_submissions','eylo_peer_reviews','eylo_feedback','eylo_api_tokens','billing_entitlements','eyra_usage_actions'] loop
  execute format('select count(*) from public.%I where user_id=$1',t) using target into remaining;
  if remaining<>0 then raise exception 'Workspace deletion incomplete';end if;
 end loop;
 update private.account_deletion_jobs set user_id=null,phase='complete',lease_token=null,lease_until=null,updated_at=now() where id=p_id;
 return jsonb_build_object('id',p_id,'phase','complete');
end$$;
create function public.release_account_deletion(p_id uuid,p_lease uuid) returns void language sql security definer set search_path='' as $$
 update private.account_deletion_jobs set lease_token=null,lease_until=null,updated_at=now() where id=p_id and lease_token=p_lease
$$;
-- Service worker can recover interrupted jobs without the user's revoked session.
create function public.pending_account_deletion() returns uuid language sql stable security definer set search_path='' as $$
 select id from private.account_deletion_jobs where phase<>'complete' and(lease_until is null or lease_until<now()) order by created_at limit 1
$$;
revoke all on function public.start_account_deletion(uuid,uuid),public.claim_account_deletion(uuid,uuid),public.account_deletion_storage_batch(uuid,uuid),public.progress_account_deletion(uuid,uuid,integer,text),public.finish_account_deletion(uuid,uuid),public.release_account_deletion(uuid,uuid),public.pending_account_deletion() from public,anon,authenticated;
grant execute on function public.start_account_deletion(uuid,uuid),public.claim_account_deletion(uuid,uuid),public.account_deletion_storage_batch(uuid,uuid),public.progress_account_deletion(uuid,uuid,integer,text),public.finish_account_deletion(uuid,uuid),public.release_account_deletion(uuid,uuid),public.pending_account_deletion() to service_role;
-- A locked account's existing personal tokens must stop immediately as well.
create or replace function public.lookup_developer_token(p_token_hash text)
returns table(id uuid,user_id uuid,project_ids uuid[],expires_at timestamptz,revoked_at timestamptz)
language sql stable security definer set search_path='' as $$
 select t.id,t.user_id,t.project_ids,t.expires_at,t.revoked_at from public.eylo_api_tokens t join auth.users u on u.id=t.user_id
 where t.token_hash=p_token_hash and t.revoked_at is null and t.expires_at>now() and(u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from private.account_deletion_jobs j where j.user_id=t.user_id) limit 1
$$;

-- Serialize metadata writes with the deletion lock, including service/signed
-- uploads that bypass RLS. The volatile trigger rechecks after acquiring the
-- same Auth-row lock used by start_account_deletion. Hosted byte-level races
-- still require actual Storage acceptance; SQL tests cover metadata only.
create function private.guard_account_storage_write() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare target uuid;prefix_id uuid;owner_text text;begin
 if auth.uid() is not null and exists(select 1 from private.account_deletion_jobs where user_id=auth.uid()) then raise exception 'Account deletion in progress' using errcode='42501';end if;
 owner_text=coalesce(nullif(to_jsonb(new)->>'owner_id',''),nullif(to_jsonb(new)->>'owner',''),'');
 if owner_text ~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then target=owner_text::uuid;end if;
 if new.bucket_id='eylo-files' and split_part(new.name,'/',1) ~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
  prefix_id=split_part(new.name,'/',1)::uuid;
  if target is not null and target<>prefix_id then raise exception 'Conflicting object owner' using errcode='42501';end if;
  target=prefix_id;
 end if;
 if target is null then return new;end if;
 perform 1 from auth.users where id=target for key share;
 if not found or exists(select 1 from private.account_deletion_jobs where user_id=target) then raise exception 'Account unavailable for Storage writes' using errcode='42501';end if;
 return new;
end$$;
revoke all on function private.guard_account_storage_write() from public,anon,authenticated,service_role;
create trigger account_storage_write_lock before insert or update on storage.objects for each row execute function private.guard_account_storage_write();
