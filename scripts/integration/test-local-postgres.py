"""Exercise workspace SQL on disposable PostgreSQL, never on a remote database.

Auth identity and Storage metadata are minimal local compatibility fixtures.
This checks actual PostgreSQL policies/triggers, not Supabase Auth/Storage services.
"""
import os
import json
from pathlib import Path
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[2]
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
ENV = {k: v for k, v in os.environ.items() if k not in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')}
NAME = 'eylo-sql-test-' + uuid.uuid4().hex[:10]
IMAGE = 'postgres:17.6-bookworm'
# One reviewed manifest drives the actual local replay and read-only safety audit.
MIGRATIONS = json.loads((ROOT / 'supabase/migration-review-plan.json').read_text())['canonical_local_order']
PLAN_REVIEW = json.loads(subprocess.check_output(
    ['node', str(ROOT / 'scripts/review-migration-plan.mjs')], cwd=ROOT, text=True,
))
if not PLAN_REVIEW['local_plan_verified'] or PLAN_REVIEW['remote_application_authorized']:
    raise RuntimeError('Canonical local migration plan was not verified; no database was started.')
BOOTSTRAP = '''
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, raw_app_meta_data jsonb not null default '{}'::jsonb, banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant execute on function auth.jwt() to authenticated,service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as
$$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1] $$;
'''

def run(*args, **kwargs):
    return subprocess.run([*DOCKER, *args], env=ENV, check=True, **kwargs)

def sql(text):
    run('exec', '-i', NAME, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', input=text, text=True)

try:
    run('run', '-d', '--name', NAME, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data',
        '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE, stdout=subprocess.DEVNULL)
    ready = False
    for _ in range(100):
        # The image starts a temporary socket-only server during initialization.
        # TCP becomes ready only after that server exits and the final server starts.
        result = subprocess.run([*DOCKER, 'exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], env=ENV, capture_output=True)
        if result.returncode == 0:
            ready = True
            break
        time.sleep(0.2)
    if not ready:
        raise RuntimeError('Disposable PostgreSQL did not become ready')
    sql(BOOTSTRAP)
    bundle_replay = os.environ.get('EYLO_SQL_RESTORATION_BUNDLE') == '1'
    legacy_replay = bundle_replay or os.environ.get('EYLO_SQL_LEGACY_SCHEMA') == '1'
    if legacy_replay:
        sql((ROOT / 'tests/integration/legacy-schema-bootstrap.sql').read_text())
    if bundle_replay:
        import hashlib
        repair = json.loads((ROOT / 'supabase/legacy-workspace-restoration-plan.json').read_text())
        if repair['project_ref'] != 'kbzjngpzxpniaumlupaa':
            raise RuntimeError('Unexpected restoration target identity')
        bridge = (ROOT / 'supabase/migrations' / repair['bridge_applied_separately']).read_text()
        sql(bridge)
        sql((ROOT / 'tests/integration/legacy-schema-postgres.sql').read_text())
        # These already exist in the observed live database. Emulate them locally
        # without replaying the incompatible historical core migration.
        for existing in ['20261115191510_workspace_timestamp_support.sql', '20260803_eylo_monitoring_entities.sql', '20260811053718_production_billing_entitlements.sql', '20261113113010_shared_discovery_quota.sql']:
            sql((ROOT / 'supabase/migrations' / existing).read_text())
        for row in repair['migrations']:
            source = ROOT / 'supabase/migrations' / row['file']
            if source.name != row['file'] or hashlib.sha256(source.read_bytes()).hexdigest() != row['sha256']:
                raise RuntimeError('Unreviewed restoration source: ' + row['file'])
            sql(source.read_text())
            print('RESTORATION source applied locally:', row['file'], flush=True)
    else:
        for name in MIGRATIONS:
            sql((ROOT / 'supabase/migrations' / name).read_text())
            print('APPLIED locally:', name, flush=True)
            if legacy_replay and name.endswith('_bridge_legacy_workspace_schema.sql'):
                sql((ROOT / 'supabase/migrations' / name).read_text())  # Idempotent replay preserves rows.
                sql((ROOT / 'tests/integration/legacy-schema-postgres.sql').read_text())
                print('PASS: legacy content/timestamps/trigger states preserved, bidirectional writes, canonical profile upsert and unchanged RLS isolation.', flush=True)
    sql((ROOT / 'tests/integration/workspace-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/learning-time-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/timer-pauses-postgres.sql').read_text())
    print('PASS: persisted timer pause/resume/stop, revisions, stale writes, duplicate active prevention, pause validation and outsider/anonymous denial.', flush=True)
    sql((ROOT / 'tests/integration/discovery-quota-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/funding-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/eyra-conversations-postgres.sql').read_text())
    if not bundle_replay:
        sql((ROOT / 'tests/integration/eyra-run-ledger-postgres.sql').read_text())
        print('PASS: EYRA durable run/action ledger owner RLS, once-only identity, client write denial and lifecycle CAS.', flush=True)
    else:
        print('NOT ACTIVATED: EYRA agent ledger is absent from the intentionally curated restoration bundle.', flush=True)
    sql((ROOT / 'tests/integration/research-records-postgres.sql').read_text())
    print('PASS: project research journal, experiments and publications roundtrip, preserve unrelated data, reject stale saves and deny outsider reads/writes/deletes.', flush=True)
    sql((ROOT / 'tests/integration/planning-documents-postgres.sql').read_text())
    print('PASS: research budget and thesis canonical project/Note persistence, unrelated-data preservation, stale-save rejection and outsider isolation.', flush=True)
    sql((ROOT / 'tests/integration/complete-products-postgres.sql').read_text())
    print('PASS: new product canonical actions/replays, team consent/role revocation, peer review privacy, feedback trusted-role checks, personal token scopes and publishing budgets.', flush=True)
    sql((ROOT / 'tests/integration/research-catalog-postgres.sql').read_text())
    print('PASS: Research Data Lab catalog metadata bounds, fingerprint uniqueness, anonymous denial and two-account RLS isolation.', flush=True)
    if not bundle_replay:
        sql((ROOT / 'tests/integration/account-deletion-postgres.sql').read_text())
        print('PASS: private deletion lifecycle, stale-token lockdown, service-only leases, Storage ordering, Auth cascades and other-author manuscript preservation; no hosted file bytes.', flush=True)
    else:
        print('NOT ACTIVATED: account deletion lifecycle intentionally excluded from restoration.', flush=True)
    export_tables = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import { WORKSPACE_EXPORT_TABLES } from './src/lib/workspace-export.mjs'; process.stdout.write(JSON.stringify(WORKSPACE_EXPORT_TABLES));"], cwd=ROOT, text=True))
    if any(not isinstance(table, str) or not table.isidentifier() for table in export_tables):
        raise AssertionError('Export registry contains an invalid table identifier')
    private_tables = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import { PRIVATE_WORKSPACE_EXPORT_TABLES } from './src/lib/workspace-export.mjs'; process.stdout.write(JSON.stringify(PRIVATE_WORKSPACE_EXPORT_TABLES));"], cwd=ROOT, text=True))
    private_list = ','.join("'" + table + "'" for table in private_tables)
    export_list = ','.join("'" + table + "'" for table in export_tables)
    sql("""
    set role authenticated;
    set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
    do $$ declare target text; exposed bigint; secured boolean; begin
      foreach target in array array[""" + export_list + """] loop
        select relrowsecurity into secured from pg_class where oid=('public.'||target)::regclass;
        if secured is distinct from true then raise exception 'Export table lacks RLS: %', target; end if;
        execute format('select * from public.%I where user_id=auth.uid() order by %I limit 1',target,case when target='eylo_directory' then 'user_id' else 'id' end);
        if target = any(array[""" + private_list + """]) then
          execute format('select count(*) from public.%I where user_id is distinct from auth.uid()',target) into exposed;
          if exposed != 0 then raise exception 'Foreign rows exposed in private export collection: %',target; end if;
        end if;
      end loop;
    end $$;
    reset role;
    """)
    print(f'PASS: all {len(export_tables)} export collections exist with RLS and authenticated owner-scoped reads; private-table foreign denial and collaboration-specific permissions tested separately; empty scopes do not establish isolation.', flush=True)
    print('PASS: disposable PostgreSQL EYRA owner RLS, message constraints, pagination, versioning and cascade deletion.', flush=True)
    version = subprocess.check_output([*DOCKER, 'exec', NAME, 'psql', '-U', 'postgres', '-Atc',
        "select updated_date from projects where id = '10000000-0000-0000-0000-000000000001'"], env=ENV, text=True).strip()

    def concurrent_save(writer):
        statement = f"""
        set role authenticated;
        set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
        with changed as (
          update projects set data = data || '{{"concurrency_writer":"{writer}"}}'::jsonb
          where id = '10000000-0000-0000-0000-000000000001' and updated_date = '{version}'::timestamptz
          returning id
        ) select count(*) from changed;
        """
        return subprocess.check_output([*DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'],
            env=ENV, input=statement, text=True).strip()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(concurrent_save, ['session-a', 'session-b']))
    if sorted(outcomes) != ['0', '1']:
        raise AssertionError('Expected one successful concurrent save and one stale conflict: ' + repr(outcomes))
    print('PASS: two independent PostgreSQL sessions competing on one project version return one save and one conflict.', flush=True)
    def concurrent_quota(_request):
        return subprocess.check_output([*DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], env=ENV,
            input="set role service_role; select allowed from consume_discovery_rate_limit(repeat('c',64),1,600);", text=True).strip()
    with ThreadPoolExecutor(max_workers=2) as pool:
        quota_outcomes = list(pool.map(concurrent_quota, [1,2]))
    if sorted(quota_outcomes) != ['f', 't']:
        raise AssertionError('Shared quota did not enforce one allowed request atomically: ' + repr(quota_outcomes))
    print('PASS: two independent PostgreSQL quota sessions allow exactly one request at a limit of one.', flush=True)
    def concurrent_snapshot(_request):
        statement = """
        begin;
        set local role authenticated;
        set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
        select (public.save_eyra_conversation_snapshot('Concurrent retry','[{"role":"user","text":"One snapshot","sources":[]}]','60000000-0000-4000-8000-000000000021')).id;
        select pg_sleep(0.3);
        commit;
        """
        return subprocess.check_output([*DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], env=ENV, input=statement, text=True).strip()
    for _race_round in range(3):
        with ThreadPoolExecutor(max_workers=2) as pool:
            snapshot_outcomes = list(pool.map(concurrent_snapshot, [1, 2]))
        if snapshot_outcomes != ['60000000-0000-4000-8000-000000000021'] * 2:
            raise AssertionError('Concurrent snapshot retries did not return the same identity: ' + repr(snapshot_outcomes))
        sql("do $$ begin if (select count(*) from eyra_messages where conversation_id='60000000-0000-4000-8000-000000000021') != 1 then raise exception 'Duplicate snapshot messages'; end if; end $$;")
        sql("delete from eyra_conversations where id='60000000-0000-4000-8000-000000000021';")
    print('PASS: two independent PostgreSQL snapshot retries return the same ID and persist exactly one message (three overlapping transaction rounds).', flush=True)
    if not bundle_replay:
        # Two independent service transactions must never reserve the same
        # signed approval or its action twice. This is disposable local SQL
        # verification, not hosted Supabase/PostgREST acceptance.
        def reserve_once(statement):
            return subprocess.check_output(
                [*DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                env=ENV, input=statement, text=True,
            ).strip()

        for _approval_round in range(3):
            approval_request = str(uuid.uuid4())
            reserve_run = f"""
            begin;
            set local role service_role;
            insert into public.eyra_agent_runs(user_id,request_id,request_hash,input_preview)
            values ('00000000-0000-0000-0000-000000000001',
                    '{approval_request}',repeat('a',64),'Exact approved project fields')
            on conflict (user_id,request_id) do nothing returning id;
            do $eyra$ begin perform pg_sleep(0.2); end $eyra$;
            commit;
            """
            with ThreadPoolExecutor(max_workers=2) as pool:
                run_results = list(pool.map(reserve_once, [reserve_run, reserve_run]))
            winners = [result for result in run_results if result]
            if len(winners) != 1:
                raise AssertionError('Concurrent approval run reservation must have exactly one winner: ' + repr(run_results))
            reserved_run_id = winners[0]
            if str(uuid.UUID(reserved_run_id)) != reserved_run_id:
                raise AssertionError('Invalid reserved approval run identity')

            reserve_action = f"""
            begin;
            set local role service_role;
            insert into public.eyra_agent_actions(run_id,user_id,call_id,tool_name,arguments_hash)
            values ('{reserved_run_id}','00000000-0000-0000-0000-000000000001',
                    'exact_fields_approved','project.create',repeat('b',64))
            on conflict (run_id,call_id) do nothing returning id;
            do $eyra$ begin perform pg_sleep(0.2); end $eyra$;
            commit;
            """
            with ThreadPoolExecutor(max_workers=2) as pool:
                action_results = list(pool.map(reserve_once, [reserve_action, reserve_action]))
            if len([result for result in action_results if result]) != 1:
                raise AssertionError('Concurrent approval action reservation must have exactly one winner: ' + repr(action_results))
            sql(f"""
            do $eyra$ begin
                if (select count(*) from public.eyra_agent_runs
                    where user_id='00000000-0000-0000-0000-000000000001'
                      and request_id='{approval_request}') != 1 then
                    raise exception 'Duplicate durable approved run';
                end if;
                if (select count(*) from public.eyra_agent_actions
                    where run_id='{reserved_run_id}' and call_id='exact_fields_approved') != 1 then
                    raise exception 'Duplicate durable approved action';
                end if;
            end $eyra$;
            delete from public.eyra_agent_runs where id='{reserved_run_id}';
            """)
        print('PASS: independent PostgreSQL approval run/action reservations have exactly one winner and no duplicates in three overlapping rounds.', flush=True)
    def concurrent_timer_transition(_index):
        statement = """
        begin;
        set local role authenticated;
        set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
        select (public.transition_time_entry('70000000-0000-4000-8000-000000000002','pause',0)).timer_revision;
        select pg_sleep(0.2);
        commit;
        """
        return subprocess.run([*DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], env=ENV, input=statement, text=True, capture_output=True)
    for _timer_race_round in range(3):
        sql("insert into public.time_entries(id,user_id,description,started_at) values ('70000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000001','Concurrent timer',now()-interval '1 hour');")
        with ThreadPoolExecutor(max_workers=2) as pool:
            timer_outcomes = list(pool.map(concurrent_timer_transition, [1, 2]))
        winners = [result for result in timer_outcomes if result.returncode == 0]
        stale = [result for result in timer_outcomes if result.returncode != 0 and '40001' in result.stderr]
        if len(winners) != 1 or len(stale) != 1:
            raise AssertionError('Expected one winning timer transition and one stale revision rejection: ' + repr([(r.returncode, r.stdout, r.stderr) for r in timer_outcomes]))
        sql("do $$ begin if not exists(select 1 from time_entries where id='70000000-0000-4000-8000-000000000002' and timer_revision=1 and jsonb_array_length(pause_intervals)=1) then raise exception 'Concurrent pause duplicated or lost history'; end if; end $$;")
        sql("delete from public.time_entries where id='70000000-0000-4000-8000-000000000002';")
    print('PASS: timer transitions serialize across independent PostgreSQL sessions; one stale request rejected with exactly one persisted pause (three rounds).', flush=True)
    # The readiness SQL is now executed on the REAL disposable PostgreSQL
    # schema, not just matched as source text. The synthetic migration registry
    # is local-test metadata only: it is NEVER copied or written remotely.
    if not bundle_replay:
        eyra_files = [
            '20261113090000_eyra_conversations.sql',
            '20261113114924_eyra_conversation_snapshots.sql',
            '20261113120556_eyra_snapshot_retry_identity.sql',
            '20261115233000_eyra_agent_runs.sql',
        ]
        if any(name not in MIGRATIONS for name in eyra_files):
            raise AssertionError('EYRA preflight fixture versions not in pinned local replay')
        registry_versions = ','.join("('" + file.split('_')[0] + "')" for file in eyra_files)
        sql("create schema supabase_migrations; "
            "create table supabase_migrations.schema_migrations(version text primary key); "
            "insert into supabase_migrations.schema_migrations(version) values " + registry_versions + ";")

        def inspect_eyra_catalog():
            output = subprocess.check_output([
                *DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres',
                '-qAt', '-v', 'ON_ERROR_STOP=1',
            ], env=ENV, input=(ROOT / 'scripts/eyra-schema-readiness.sql').read_text(), text=True)
            return json.loads(output.strip())

        def assert_eyra_preflight(expected, context):
            probe = inspect_eyra_catalog()
            evaluation = subprocess.check_output([
                'node', '--input-type=module', '-e',
                "import {evaluateEyraSchemaReadiness as check} from './src/lib/eyra-schema-readiness.mjs';"
                "let data=''; for await(const part of process.stdin) data+=part;"
                "process.stdout.write(JSON.stringify(check(JSON.parse(data))));",
            ], cwd=ROOT, input=json.dumps(probe), text=True)
            result = json.loads(evaluation)
            if result['schema_metadata_passed'] is not expected:
                raise AssertionError('EYRA readiness ' + context + ': ' + repr(result))
            if result['production_release_approved'] or result['remote_application_authorized']:
                raise AssertionError('EYRA catalog metadata must never authorize a remote release')
            return result

        good_catalog = assert_eyra_preflight(True, 'canonical local schema')
        if good_catalog['decision'] != 'HOSTED_TWO_ACCOUNT_ACCEPTANCE_REQUIRED':
            raise AssertionError('Staging two-user acceptance must remain mandatory')
        print('PASS: real disposable PostgreSQL EYRA metadata preflight verifies schema, grants and invoker RPC without authorizing release.', flush=True)

        # Negative controls mutate ONLY this temporary database AFTER existing
        # functional SQL tests, to verify SQL + evaluator really detect drift.
        sql('revoke select on public.eyra_agent_runs from authenticated;')
        assert_eyra_preflight(False, 'revoked authenticated run-ledger read')
        sql('grant select on public.eyra_agent_runs to authenticated;')
        sql('alter table public.eyra_messages disable row level security;')
        assert_eyra_preflight(False, 'disabled message RLS')
        print('PASS: local EYRA preflight fails closed for revoked SELECT and disabled RLS.', flush=True)
    else:
        print('SKIP: EYRA ledger metadata preflight requires the full canonical local migration replay.', flush=True)
    print('PASS: PostgreSQL migration execution, two-role workspace isolation, version history, search, project links and Storage metadata policies.', flush=True)
    print('NOT VERIFIED: hosted Supabase Auth, PostgREST, Storage bytes, deployed schema, or hosted service-role operations.', flush=True)
finally:
    subprocess.run([*DOCKER, 'rm', '-f', NAME], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
