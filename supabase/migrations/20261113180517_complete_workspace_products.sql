-- Proposed additive contracts. Apply only to separately verified staging.
-- Projects/Notes/Life/Calendar remain the canonical private records.
create schema if not exists private;
create table public.eylo_directory(user_id uuid primary key references auth.users(id) on delete cascade,display_name text not null check(length(display_name) between 1 and 100),about text not null default '' check(length(about)<=1000),visible boolean not null default false,created_date timestamptz not null default now(),updated_date timestamptz not null default now());
create table public.eylo_teams(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 100),created_date timestamptz not null default now(),updated_date timestamptz not null default now());
create table public.eylo_team_invites(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.eylo_teams on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,recipient_id uuid not null references auth.users(id) on delete cascade,status text not null default 'pending' check(status in('pending','accepted','declined','cancelled','joined')),created_date timestamptz not null default now(),updated_date timestamptz not null default now(),check(user_id<>recipient_id));
create unique index eylo_team_invites_active on public.eylo_team_invites(team_id,recipient_id) where status='pending';
create table public.eylo_team_members(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.eylo_teams on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'member' check(role in('member','admin')),created_date timestamptz not null default now(),updated_date timestamptz not null default now(),unique(team_id,user_id));
create table public.eylo_connections(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,recipient_id uuid not null references auth.users(id) on delete cascade,status text not null default 'pending' check(status in('pending','accepted','declined','disconnected')),created_date timestamptz not null default now(),updated_date timestamptz not null default now(),check(user_id<>recipient_id));
create unique index eylo_connections_active on public.eylo_connections(least(user_id,recipient_id),greatest(user_id,recipient_id)) where status in('pending','accepted');
create table public.eylo_community_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,parent_id uuid references public.eylo_community_posts on delete set null,body text not null check(length(body) between 1 and 4000),created_date timestamptz not null default now(),updated_date timestamptz not null default now());
create table public.eylo_peer_submissions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,reviewer_id uuid not null references auth.users(id) on delete cascade,title text not null check(length(title) between 1 and 200),content text not null check(length(content) between 1 and 50000),created_date timestamptz not null default now(),updated_date timestamptz not null default now(),check(user_id<>reviewer_id));
create table public.eylo_peer_reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,submission_id uuid not null references public.eylo_peer_submissions on delete cascade,summary text not null default '' check(length(summary)<=6000),strengths text not null default '' check(length(strengths)<=4000),concerns text not null default '' check(length(concerns)<=4000),status text not null default 'draft' check(status in('draft','submitted')),created_date timestamptz not null default now(),updated_date timestamptz not null default now(),unique(submission_id,user_id),check(status='draft' or length(trim(summary))>0));
create table public.eylo_feedback(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,category text not null check(category in('bug','feature','experience')),body text not null check(length(body) between 1 and 4000),status text not null default 'submitted' check(status in('submitted','triaged','planned','closed')),created_date timestamptz not null default now(),updated_date timestamptz not null default now());
create table public.eylo_api_tokens(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 100),token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),project_ids uuid[] not null check(cardinality(project_ids) between 1 and 20),expires_at timestamptz not null,revoked_at timestamptz,created_date timestamptz not null default now(),updated_date timestamptz not null default now(),check(expires_at>created_date and expires_at<=created_date+interval '90 days'));
-- Private boolean helpers avoid membership-policy recursion. They reveal only
-- the current caller's own authorization, have a fixed search path, and are not public RPCs.
create function private.eylo_team_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and(exists(select 1 from public.eylo_teams where id=target and user_id=auth.uid()) or exists(select 1 from public.eylo_team_members where team_id=target and user_id=auth.uid()))$$;
create function private.eylo_team_admin(target uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and(exists(select 1 from public.eylo_teams where id=target and user_id=auth.uid()) or exists(select 1 from public.eylo_team_members where team_id=target and user_id=auth.uid() and role='admin'))$$;
create function private.eylo_is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and coalesce(raw_app_meta_data->>'eylo_role','')='admin' and (banned_until is null or banned_until<=now())) and exists(select 1 from auth.sessions where user_id=auth.uid() and id=case when auth.jwt()->>'session_id' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then (auth.jwt()->>'session_id')::uuid else null end)$$;
revoke all on function private.eylo_team_member(uuid),private.eylo_team_admin(uuid),private.eylo_is_admin() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.eylo_team_member(uuid),private.eylo_team_admin(uuid),private.eylo_is_admin() to authenticated;
do $$declare t text;begin foreach t in array array['eylo_directory','eylo_teams','eylo_team_invites','eylo_team_members','eylo_connections','eylo_community_posts','eylo_peer_submissions','eylo_peer_reviews','eylo_feedback','eylo_api_tokens'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,delete on public.%I to authenticated',t);
 execute format('create index %I on public.%I(user_id)',t||'_owner_idx',t);
 execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_date()',t||'_updated',t);
end loop;end$$;
grant update(display_name,about,visible) on public.eylo_directory to authenticated;
grant update(name) on public.eylo_teams to authenticated;
grant update(status) on public.eylo_team_invites,public.eylo_connections,public.eylo_feedback to authenticated;
grant update(role) on public.eylo_team_members to authenticated;
grant update(body) on public.eylo_community_posts to authenticated;
grant update(summary,strengths,concerns,status) on public.eylo_peer_reviews to authenticated;
grant update(revoked_at) on public.eylo_api_tokens to authenticated;
create policy directory_read on public.eylo_directory for select to authenticated using(visible or user_id=auth.uid());
create policy directory_insert on public.eylo_directory for insert to authenticated with check(user_id=auth.uid());
create policy directory_update on public.eylo_directory for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy directory_delete on public.eylo_directory for delete to authenticated using(user_id=auth.uid());
create policy teams_read on public.eylo_teams for select to authenticated using(private.eylo_team_member(id) or exists(select 1 from public.eylo_team_invites where team_id=eylo_teams.id and recipient_id=auth.uid() and status='pending'));
create policy teams_insert on public.eylo_teams for insert to authenticated with check(user_id=auth.uid());
create policy teams_update on public.eylo_teams for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy teams_delete on public.eylo_teams for delete to authenticated using(user_id=auth.uid());
create policy invites_read on public.eylo_team_invites for select to authenticated using(user_id=auth.uid() or recipient_id=auth.uid() or private.eylo_team_admin(team_id));
create policy invites_insert on public.eylo_team_invites for insert to authenticated with check(user_id=auth.uid() and status='pending' and private.eylo_team_admin(team_id) and exists(select 1 from public.eylo_directory where user_id=recipient_id and visible));
create policy invites_accept on public.eylo_team_invites for update to authenticated using(recipient_id=auth.uid() and status='pending') with check(recipient_id=auth.uid() and status in('accepted','declined'));
create policy invites_cancel on public.eylo_team_invites for update to authenticated using((user_id=auth.uid() or private.eylo_team_admin(team_id)) and status='pending') with check((user_id=auth.uid() or private.eylo_team_admin(team_id)) and status='cancelled');
create policy members_read on public.eylo_team_members for select to authenticated using(user_id=auth.uid() or private.eylo_team_member(team_id));
create policy members_join on public.eylo_team_members for insert to authenticated with check(user_id=auth.uid() and role='member');
create policy members_role on public.eylo_team_members for update to authenticated using(exists(select 1 from public.eylo_teams where id=team_id and user_id=auth.uid())) with check(exists(select 1 from public.eylo_teams where id=team_id and user_id=auth.uid()));
create policy members_remove on public.eylo_team_members for delete to authenticated using(user_id=auth.uid() or exists(select 1 from public.eylo_teams where id=team_id and user_id=auth.uid()));
create policy connections_read on public.eylo_connections for select to authenticated using(user_id=auth.uid() or recipient_id=auth.uid());
create policy connections_insert on public.eylo_connections for insert to authenticated with check(user_id=auth.uid() and status='pending' and exists(select 1 from public.eylo_directory where user_id=recipient_id and visible));
create policy connections_accept on public.eylo_connections for update to authenticated using(recipient_id=auth.uid() and status='pending') with check(recipient_id=auth.uid() and status in('accepted','declined'));
create policy connections_disconnect on public.eylo_connections for update to authenticated using((user_id=auth.uid() or recipient_id=auth.uid()) and status in('pending','accepted')) with check(status='disconnected' and(user_id=auth.uid() or recipient_id=auth.uid()));
create policy community_read on public.eylo_community_posts for select to authenticated using(true);
create policy community_insert on public.eylo_community_posts for insert to authenticated with check(user_id=auth.uid());
create policy community_update on public.eylo_community_posts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy community_delete on public.eylo_community_posts for delete to authenticated using(user_id=auth.uid());
create policy submissions_read on public.eylo_peer_submissions for select to authenticated using(user_id=auth.uid() or reviewer_id=auth.uid());
create policy submissions_insert on public.eylo_peer_submissions for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.eylo_connections where status='accepted' and((user_id=auth.uid() and recipient_id=reviewer_id)or(recipient_id=auth.uid() and user_id=reviewer_id))));
create policy submissions_delete on public.eylo_peer_submissions for delete to authenticated using(user_id=auth.uid());
create policy reviews_read on public.eylo_peer_reviews for select to authenticated using(user_id=auth.uid() or(status='submitted' and exists(select 1 from public.eylo_peer_submissions where id=submission_id and user_id=auth.uid())));
create policy reviews_insert on public.eylo_peer_reviews for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.eylo_peer_submissions where id=submission_id and reviewer_id=auth.uid()));
create policy reviews_update on public.eylo_peer_reviews for update to authenticated using(user_id=auth.uid() and status='draft') with check(user_id=auth.uid() and status in('draft','submitted'));
create policy reviews_delete on public.eylo_peer_reviews for delete to authenticated using(user_id=auth.uid() and status='draft');
create policy feedback_read on public.eylo_feedback for select to authenticated using(user_id=auth.uid() or private.eylo_is_admin());
create policy feedback_insert on public.eylo_feedback for insert to authenticated with check(user_id=auth.uid() and status='submitted');
create policy feedback_update on public.eylo_feedback for update to authenticated using(private.eylo_is_admin()) with check(private.eylo_is_admin());
create policy feedback_delete on public.eylo_feedback for delete to authenticated using(user_id=auth.uid());
create policy tokens_read on public.eylo_api_tokens for select to authenticated using(user_id=auth.uid());
create policy tokens_insert on public.eylo_api_tokens for insert to authenticated with check(user_id=auth.uid() and revoked_at is null and expires_at>now() and expires_at<=now()+interval '90 days' and not exists(select 1 from unnest(project_ids) target left join public.projects p on p.id=target and p.user_id=auth.uid() where p.id is null));
create policy tokens_revoke on public.eylo_api_tokens for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and revoked_at is not null);
create policy tokens_delete on public.eylo_api_tokens for delete to authenticated using(user_id=auth.uid());
grant select on public.eylo_api_tokens to service_role;
-- Bound publishing/feedback at the database boundary, including concurrent clients.
create function private.eylo_publish_budget() returns trigger language plpgsql security invoker set search_path='' as $$begin perform private.consume_product_action_budget(tg_table_name);new.created_date=now();return new;end$$;
revoke all on function private.eylo_publish_budget() from public,anon,authenticated;
create trigger community_budget before insert on public.eylo_community_posts for each row execute function private.eylo_publish_budget();
create trigger feedback_budget before insert on public.eylo_feedback for each row execute function private.eylo_publish_budget();
-- Atomic, idempotent creation of existing canonical tasks from a saved workflow.
create function public.run_project_task_workflow(p_project_id uuid,p_workflow_id uuid,p_run_id uuid,p_expected_version timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.projects;definition jsonb;run jsonb;step text;task_id uuid;task_ids jsonb='[]';runs jsonb;n integer=0;begin
 if auth.uid() is null or p_run_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into p from public.projects where id=p_project_id and user_id=auth.uid() for update;
 if p.id is null then raise exception 'Project unavailable' using errcode='42501';end if;
 runs=coalesce(p.data->'product_workflow_runs','[]');
 select value into run from jsonb_array_elements(runs) where value->>'id'=p_run_id::text;
 if run is not null then if run->>'workflow_id'<>p_workflow_id::text then raise exception 'Conflicting operation identity';end if;return run;end if;
 if p.updated_date is distinct from p_expected_version then raise exception 'Project changed; reload before running' using errcode='40001';end if;
 if jsonb_array_length(runs)>=100 then raise exception 'Workflow run budget exhausted';end if;
 select value into definition from jsonb_array_elements(p.data->'product_workbench'->'workflows'->'records') where value->>'id'=p_workflow_id::text;
 if definition is null or length(trim(coalesce(definition->>'steps','')))=0 or length(definition->>'steps')>6000 then raise exception 'Invalid saved workflow';end if;
 perform private.consume_product_action_budget('workflow');
 foreach step in array regexp_split_to_array(definition->>'steps',E'\n') loop
 step=btrim(step,E' \t\r');if step='' then continue;end if;n=n+1;if n>20 then raise exception 'Workflow exceeds20 tasks';end if;if length(step)>160 then raise exception 'Task title too long';end if;
 insert into public.life_tasks(user_id,data) values(auth.uid(),jsonb_build_object('title',step,'status','todo','project_id',p.id::text)) returning id into task_id;
 task_ids=task_ids||to_jsonb(task_id);end loop;
 if n=0 then raise exception 'Workflow has no tasks';end if;run=jsonb_build_object('id',p_run_id,'workflow_id',p_workflow_id,'task_ids',task_ids,'created_at',now());
 update public.projects set data=jsonb_set(data,'{product_workflow_runs}',runs||jsonb_build_array(run)) where id=p.id and user_id=auth.uid();return run;
end$$;
revoke all on function public.run_project_task_workflow(uuid,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.run_project_task_workflow(uuid,uuid,uuid,timestamptz) to authenticated;
create function public.materialize_workbench_record(p_project_id uuid,p_tool text,p_record_id uuid,p_result_id uuid,p_expected_version timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.projects;record jsonb;previous jsonb;results jsonb;result jsonb;deadline date;begin
 if auth.uid() is null or p_result_id is null or p_tool not in('studio','conferences') then raise exception 'Action not permitted' using errcode='42501';end if;
 select * into p from public.projects where id=p_project_id and user_id=auth.uid() for update;
 if p.id is null then raise exception 'Project unavailable' using errcode='42501';end if;
 results=coalesce(p.data->'product_materializations','[]');
 select value into previous from jsonb_array_elements(results) where value->>'id'=p_result_id::text;
 if previous is not null then if previous->>'tool'<>p_tool or previous->>'record_id'<>p_record_id::text then raise exception 'Conflicting operation identity';end if;return previous;end if;
 if p.updated_date is distinct from p_expected_version or jsonb_array_length(results)>=100 then raise exception 'Project changed or materialization budget exhausted';end if;
 select value into record from jsonb_array_elements(p.data->'product_workbench'->p_tool->'records') where value->>'id'=p_record_id::text;
 if record is null or length(trim(coalesce(record->>'title','')))=0 or length(record->>'title')>160 then raise exception 'Saved record unavailable';end if;
 perform private.consume_product_action_budget(p_tool);
 if p_tool='studio' then
 if length(trim(coalesce(record->>'content','')))=0 or length(record->>'content')>20000 then raise exception 'Invalid document content';end if;
 insert into public.notes(id,user_id,data) values(p_result_id,auth.uid(),jsonb_build_object('title',record->>'title','content',record->>'content','project_id',p.id::text,'tags',jsonb_build_array('studio')));
 else
 if coalesce(record->>'deadline','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid deadline';end if;deadline=(record->>'deadline')::date;
 insert into public.calendar_events(id,user_id,data) values(p_result_id,auth.uid(),jsonb_build_object('title','Submission: '||(record->>'title'),'project_id',p.id::text,'start_at',deadline::text||'T00:00:00Z','end_at',(deadline+1)::text||'T00:00:00Z','all_day',true,'timezone','UTC'));
 end if;
 result=jsonb_build_object('id',p_result_id,'tool',p_tool,'record_id',p_record_id,'created_at',now());
 update public.projects set data=jsonb_set(data,'{product_materializations}',results||jsonb_build_array(result)) where id=p.id and user_id=auth.uid();return result;
end$$;
revoke all on function public.materialize_workbench_record(uuid,text,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.materialize_workbench_record(uuid,text,uuid,uuid,timestamptz) to authenticated;

-- An accepted invite is consumed in the membership INSERT transaction. A removed
-- member cannot reuse a past accepted invite to restore revoked access.
create function private.eylo_consume_invite() returns trigger language plpgsql security definer set search_path='' as $$
declare invitation uuid;begin
 if auth.uid() is null or new.user_id<>auth.uid() or new.role<>'member' then raise exception 'Invalid membership' using errcode='42501';end if;
 select i.id into invitation from public.eylo_team_invites i where i.team_id=new.team_id and i.recipient_id=auth.uid() and i.status='accepted' and i.created_date>now()-interval '7 days' and (exists(select 1 from public.eylo_teams t where t.id=i.team_id and t.user_id=i.user_id) or exists(select 1 from public.eylo_team_members m where m.team_id=i.team_id and m.user_id=i.user_id and m.role='admin')) for update;
 if invitation is null then raise exception 'No current accepted invitation' using errcode='42501';end if;
 update public.eylo_team_invites set status='joined' where id=invitation;return new;end$$;
revoke all on function private.eylo_consume_invite() from public,anon,authenticated;
create trigger consume_team_invite before insert on public.eylo_team_members for each row execute function private.eylo_consume_invite();
create function private.eylo_stamp_insert() returns trigger language plpgsql security invoker set search_path='' as $$begin new.created_date=now();new.updated_date=now();return new;end$$;
revoke all on function private.eylo_stamp_insert() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['eylo_directory','eylo_teams','eylo_team_invites','eylo_team_members','eylo_connections','eylo_community_posts','eylo_peer_submissions','eylo_peer_reviews','eylo_feedback','eylo_api_tokens'] loop execute format('create trigger stamp_insert before insert on public.%I for each row execute function private.eylo_stamp_insert()',t);end loop;end$$;

-- Explicit canonical reads for the scoped server API; no client receives this role.
grant select on public.projects,public.notes to service_role;
create function public.save_authored_tool_note(p_id uuid,p_title text,p_content text) returns uuid language plpgsql security invoker set search_path='' as $$declare existing public.notes;inserted_count integer;begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if length(trim(coalesce(p_title,'')))=0 or length(p_title)>200 or length(coalesce(p_content,''))>100000 then raise exception 'Invalid note';end if;
 insert into public.notes(id,user_id,data) values(p_id,auth.uid(),jsonb_build_object('title',p_title,'content',p_content,'tags',jsonb_build_array('translation'))) on conflict(id) do nothing;
 get diagnostics inserted_count=row_count;if inserted_count>0 then perform private.consume_product_action_budget('translation');end if;
 select * into existing from public.notes where id=p_id and user_id=auth.uid();
 if existing.id is null or existing.data->>'title'<>p_title or existing.data->>'content'<>p_content then raise exception 'Conflicting note identity' using errcode='42501';end if;return existing.id;end$$;
revoke all on function public.save_authored_tool_note(uuid,text,text) from public,anon;grant execute on function public.save_authored_tool_note(uuid,text,text) to authenticated;

-- Bounded authored submissions, invitations, team creation and credential issue.
do $$declare t text;begin foreach t in array array['eylo_peer_submissions','eylo_team_invites','eylo_connections','eylo_teams','eylo_api_tokens'] loop execute format('create trigger publish_budget before insert on public.%I for each row execute function private.eylo_publish_budget()',t);end loop;end$$;
-- Narrow service-only credential lookup also checks current account ban state.
create function public.lookup_developer_token(p_token_hash text)
returns table(id uuid,user_id uuid,project_ids uuid[],expires_at timestamptz,revoked_at timestamptz)
language sql stable security definer set search_path='' as $$
 select t.id,t.user_id,t.project_ids,t.expires_at,t.revoked_at from public.eylo_api_tokens t join auth.users u on u.id=t.user_id
 where t.token_hash=p_token_hash and t.revoked_at is null and t.expires_at>now() and(u.banned_until is null or u.banned_until<=now()) limit 1
$$;
revoke all on function public.lookup_developer_token(text) from public,anon,authenticated;
grant execute on function public.lookup_developer_token(text) to service_role;

-- Common permission predicates and incoming/FK lookups remain indexed.
create index eylo_invites_recipient_idx on public.eylo_team_invites(recipient_id,status,team_id);
create index eylo_connections_recipient_idx on public.eylo_connections(recipient_id,status);
create index eylo_submissions_reviewer_idx on public.eylo_peer_submissions(reviewer_id,created_date desc);
create index eylo_community_parent_idx on public.eylo_community_posts(parent_id,created_date);

-- Reuse the single reviewed atomic limiter store. Caller identity and limits
-- are fixed here; authenticated callers cannot consume another user's quota.
create function private.consume_product_action_budget(p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare permitted boolean;budget integer;subject text;begin
 if auth.uid() is null or p_action not in('workflow','studio','conferences','translation','eylo_community_posts','eylo_feedback','eylo_peer_submissions','eylo_team_invites','eylo_connections','eylo_teams','eylo_api_tokens') then raise exception 'Action not permitted' using errcode='42501';end if;
 budget=case when p_action in('studio','conferences','translation') then 50 else 20 end;
 subject=encode(sha256(convert_to('eylo-product-action:'||auth.uid()::text||':'||p_action,'UTF8')),'hex');
 select result.allowed into permitted from public.consume_discovery_rate_limit(subject,budget,86400) result;
 if permitted is distinct from true then raise exception 'Daily workspace action budget exhausted' using errcode='54000';end if;
end$$;
revoke all on function private.consume_product_action_budget(text) from public,anon;
grant execute on function private.consume_product_action_budget(text) to authenticated;
