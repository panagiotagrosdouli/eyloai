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
MIGRATIONS = [
    '20260803_eylo_core_entities.sql',
    '20260803_eylo_monitoring_entities.sql',
    '20261112154425_private_notes.sql',
    '20261112161818_eylo_life_tasks.sql',
    '20261112163010_eylo_life_goals_milestones.sql',
    '20261112165449_eylo_study_flashcards.sql',
    '20261112173500_eylo_calendar_events.sql',
    '20261112181000_eylo_activity_history.sql',
    '20261112183722_universal_workspace_search.sql',
    '20261112190430_eylo_files.sql',
    '20261112200000_private_file_search.sql',
    '20261112090000_project_scoped_grant_applications.sql',
    '20261112091000_saved_paper_identity_uniqueness.sql',
    '20261113062923_canonical_learning_time.sql',
    '20261113113010_shared_discovery_quota.sql',
    '20261113090000_eyra_conversations.sql',
    '20261113114924_eyra_conversation_snapshots.sql',
    '20261113120556_eyra_snapshot_retry_identity.sql',
    '20261113180517_complete_workspace_products.sql',
]
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
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
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
    for name in MIGRATIONS:
        sql((ROOT / 'supabase/migrations' / name).read_text())
        print('APPLIED locally:', name, flush=True)
    sql((ROOT / 'tests/integration/workspace-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/learning-time-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/discovery-quota-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/funding-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/eyra-conversations-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/research-records-postgres.sql').read_text())
    print('PASS: project research journal, experiments and publications roundtrip, preserve unrelated data, reject stale saves and deny outsider reads/writes/deletes.', flush=True)
    sql((ROOT / 'tests/integration/planning-documents-postgres.sql').read_text())
    print('PASS: research budget and thesis canonical project/Note persistence, unrelated-data preservation, stale-save rejection and outsider isolation.', flush=True)
    sql((ROOT / 'tests/integration/complete-products-postgres.sql').read_text())
    print('PASS: new product canonical actions/replays, team consent/role revocation, peer review privacy, feedback trusted-role checks, personal token scopes and publishing budgets.', flush=True)
    export_tables = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import { WORKSPACE_EXPORT_TABLES } from './src/lib/workspace-export.mjs'; process.stdout.write(JSON.stringify(WORKSPACE_EXPORT_TABLES));"], cwd=ROOT, text=True))
    if any(not isinstance(table, str) or not table.isidentifier() for table in export_tables):
        raise AssertionError('Export registry contains an invalid table identifier')
    export_list = ','.join("'" + table + "'" for table in export_tables)
    sql("""
    set role authenticated;
    set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
    do $$ declare target text; exposed bigint; secured boolean; begin
      foreach target in array array[""" + export_list + """] loop
        select relrowsecurity into secured from pg_class where oid=('public.'||target)::regclass;
        if secured is distinct from true then raise exception 'Export table lacks RLS: %', target; end if;
        execute format('select * from public.%I where user_id=auth.uid() order by id limit 1',target);
        execute format('select count(*) from public.%I where user_id is distinct from auth.uid()',target) into exposed;
        if exposed != 0 then raise exception 'Foreign rows exposed in export collection: %',target; end if;
      end loop;
    end $$;
    reset role;
    """)
    print(f'PASS: all {len(export_tables)} canonical export collections exist, have RLS enabled and permit authenticated owner reads; empty scopes do not establish isolation.', flush=True)
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
    print('PASS: PostgreSQL migration execution, two-role workspace isolation, version history, search, project links and Storage metadata policies.', flush=True)
    print('NOT VERIFIED: hosted Supabase Auth, PostgREST, Storage bytes, deployed schema, or service-role operations.', flush=True)
finally:
    subprocess.run([*DOCKER, 'rm', '-f', NAME], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
