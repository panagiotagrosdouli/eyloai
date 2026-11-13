"""Exercise workspace SQL on disposable PostgreSQL, never on a remote database.

Auth identity and Storage metadata are minimal local compatibility fixtures.
This checks actual PostgreSQL policies/triggers, not Supabase Auth/Storage services.
"""
import os
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
    '20261112154425_private_notes.sql',
    '20261112161818_eylo_life_tasks.sql',
    '20261112163010_eylo_life_goals_milestones.sql',
    '20261112165449_eylo_study_flashcards.sql',
    '20261112173500_eylo_calendar_events.sql',
    '20261112181000_eylo_activity_history.sql',
    '20261112183722_universal_workspace_search.sql',
    '20261112190430_eylo_files.sql',
    '20261112200000_private_file_search.sql',
    '20261113090000_eyra_conversations.sql',
    '20261113110000_eyra_conversation_writes.sql',
]
BOOTSTRAP = '''
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
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
    sql((ROOT / 'tests/integration/eyra-conversations-postgres.sql').read_text())
    sql((ROOT / 'tests/integration/eyra-conversation-writes-postgres.sql').read_text())
    print('PASS: PostgreSQL owner-scoped EYRA write RPCs, retries and error atomicity.', flush=True)
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
    def concurrent_eyra_append(message_id):
        statement = f"""
        set role authenticated;
        set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
        select (public.eyra_append_message(
          '80000000-0000-0000-0000-000000000001',
          '{message_id}', 'user', 'Parallel append'
        )->>'sequence_number');
        """
        return subprocess.check_output([*DOCKER, 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'],
            env=ENV, input=statement, text=True).strip()

    with ThreadPoolExecutor(max_workers=2) as pool:
        positions = list(pool.map(concurrent_eyra_append, [
            '90000000-0000-0000-0000-000000000005',
            '90000000-0000-0000-0000-000000000006',
        ]))
    if sorted(positions) != ['2', '3']:
        raise AssertionError('EYRA concurrent sequence allocation must be unique and monotone: ' + repr(positions))
    print('PASS: parallel PostgreSQL sessions assigned unique contiguous EYRA message sequence numbers.', flush=True)

    print('PASS: PostgreSQL migration execution, two-role workspace isolation, version history, search, project links and Storage metadata policies.', flush=True)
    print('NOT VERIFIED: hosted Supabase Auth, PostgREST, Storage bytes, deployed schema, or service-role operations.', flush=True)
finally:
    subprocess.run([*DOCKER, 'rm', '-f', NAME], env=ENV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
