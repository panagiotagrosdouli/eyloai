import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const repoRoot = process.cwd();
const projectDir = path.resolve(process.argv[2] || '');
const runnerTemp = path.resolve(process.env.RUNNER_TEMP || '');
if (!runnerTemp || !projectDir.startsWith(runnerTemp + path.sep)) {
  throw new Error('Recovery acceptance requires an isolated project below RUNNER_TEMP.');
}
for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'SUPABASE_URL']) {
  if (process.env[key]) throw new Error('Remote Supabase configuration is forbidden in disposable recovery acceptance.');
}
const apiUrl = process.env.LOCAL_SUPABASE_URL;
const publishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.LOCAL_SUPABASE_SECRET_KEY;
if (!apiUrl || !publishableKey || !secretKey) throw new Error('Local Supabase endpoints are incomplete.');
const parsedUrl = new URL(apiUrl);
if (parsedUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)) {
  throw new Error('Recovery acceptance is restricted to loopback Supabase endpoints.');
}
const dbContainer = 'supabase_db_' + path.basename(projectDir);
const migrationName = '20261128145000_scholarly_provider_coordination.sql';
const migrationPath = path.join(repoRoot, 'supabase/migrations', migrationName);
const preflightPath = path.join(repoRoot, 'supabase/recovery/scholarly_provider_coordination_preflight.sql');
const migration = await readFile(migrationPath, 'utf8');
const preflightSql = await readFile(preflightPath, 'utf8');
const plan = JSON.parse(await readFile(path.join(repoRoot, 'supabase/migration-review-plan.json'), 'utf8'));
const expectedSha = plan.files.find(row => row.name === migrationName)?.sha256;
assert.ok(expectedSha, 'Provider coordination migration must be SHA-pinned in the local replay plan.');
assert.equal(createHash('sha256').update(migration).digest('hex'), expectedSha, 'Recovery must use the reviewed migration bytes.');
const initialManifestPath = path.join(projectDir, 'reviewed-migration-replay.json');
const initialManifest = JSON.parse(await readFile(initialManifestPath, 'utf8'));
assert.equal(initialManifest.some(row => row.source === migrationName), false, 'Migration must be absent before recovery preflight.');

function psql(sql, { singleTransaction = false, expectFailure = false } = {}) {
  const args = [
    'exec', '-i', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-v', 'ON_ERROR_STOP=1', '-qAt',
  ];
  if (singleTransaction) args.push('--single-transaction');
  const result = spawnSync('docker', args, { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw new Error('Disposable PostgreSQL command could not start.');
  if (expectFailure) {
    assert.notEqual(result.status, 0, 'Deliberately interrupted transaction must fail.');
  } else if (result.status !== 0) {
    throw new Error('Disposable PostgreSQL query failed: ' + String(result.stderr || result.stdout).slice(-1200));
  }
  return String(result.stdout || '').trim();
}
function jsonQuery(sql) {
  const output = psql(sql);
  try { return JSON.parse(output); }
  catch { throw new Error('Disposable PostgreSQL returned invalid JSON catalog output.'); }
}
function row(data) { return Array.isArray(data) ? data[0] : data; }
function requireSuccess(result, label) {
  if (result.error) throw new Error(label + ' failed with database code ' + String(result.error.code || 'unknown'));
  return result.data;
}
function expectDenied(result, label) {
  assert.ok(result.error, label + ' must be denied.');
}
function key(label) { return createHash('sha256').update('eylo-recovery:' + label + ':' + randomUUID()).digest('hex'); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const anon = createClient(apiUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
let testUserId;
let authenticated;

const preflight = () => jsonQuery(preflightSql);
const missingObjects = result => {
  assert.equal(result.migration_recorded, false, 'Migration ledger must not contain the target before apply.');
  assert.equal(result.overall, 'SAFE_CANDIDATE_ONLY_AFTER_STAGING_AND_BACKUP');
  assert.deepEqual(result.table_objects.map(item => item.status), ['MISSING', 'MISSING', 'MISSING']);
  assert.deepEqual(result.rpc_objects.map(item => item.status), ['MISSING', 'MISSING', 'MISSING', 'MISSING']);
};

console.log('Recovery preflight: checking representative schema without provider coordination objects.');
missingObjects(preflight());

console.log('Recovery interruption: failing after the first CREATE TABLE and checking transactional rollback.');
const firstTableEnd = migration.indexOf('create table public.scholarly_provider_leases');
assert.ok(firstTableEnd > 0, 'Migration must include the expected first-table boundary.');
psql(migration.slice(0, firstTableEnd) + '\nselect 1 / 0;\n', { singleTransaction: true, expectFailure: true });
missingObjects(preflight());

console.log('Recovery apply: applying the exact SHA-pinned migration in one PostgreSQL transaction.');
psql(migration, { singleTransaction: true });
psql("notify pgrst, 'reload schema'; select pg_sleep(1.5);");
await copyFile(migrationPath, path.join(projectDir, 'supabase/migrations', migrationName));
execFileSync('supabase', ['migration', 'repair', '20261128145000', '--status', 'applied', '--yes'], {
  cwd: projectDir, stdio: 'pipe', encoding: 'utf8',
});

const catalogSql = `
select jsonb_build_object(
 'migration_recorded', exists(select 1 from supabase_migrations.schema_migrations where version='20261128145000'),
 'schema_usage_service_role', has_schema_privilege('service_role','public','USAGE'),
 'tables', (
  select jsonb_agg(jsonb_build_object(
   'name',t.relname,'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,
   'columns',(select jsonb_object_agg(a.attname,jsonb_build_object(
     'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
     from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid,true),'delete_action',c.confdeltype) order by c.conname) from pg_constraint c where c.conrelid=t.oid),
   'indexes',(select jsonb_agg(jsonb_build_object('name',i.indexname,'definition',i.indexdef) order by i.indexname) from pg_indexes i where i.schemaname='public' and i.tablename=t.relname),
   'policies',(select count(*) from pg_policies p where p.schemaname='public' and p.tablename=t.relname),
   'public_grant',coalesce((select bool_or(a.grantee=0) from aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a),false),
   'direct_roles',(select jsonb_agg(r.rolname order by r.rolname) from pg_roles r where r.rolname in ('anon','authenticated','service_role') and has_table_privilege(r.rolname,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  ) order by t.relname)
  from pg_class t join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname in ('scholarly_provider_state','scholarly_provider_leases','scholarly_response_cache') and t.relkind='r'
 ),
 'functions', (
  select jsonb_agg(jsonb_build_object(
   'name',p.proname,'identity',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),
   'result',pg_get_function_result(p.oid),'security_definer',p.prosecdef,'config',p.proconfig,
   'owner',pg_get_userbyid(p.proowner),'body',pg_get_functiondef(p.oid),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
   'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'public_execute',coalesce((select bool_or(a.grantee=0 and a.privilege_type='EXECUTE') from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),false)
  ) order by p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('reserve_scholarly_provider_slot','finish_scholarly_provider_request','read_scholarly_provider_cache','write_scholarly_provider_cache')
 )
);
`;
const contract = jsonQuery(catalogSql);
assert.equal(contract.migration_recorded, true, 'Exact migration version must be reconciled in the local ledger.');
assert.equal(contract.schema_usage_service_role, true);
assert.equal(contract.tables.length, 3);
assert.equal(contract.functions.length, 4);
const tableMap = new Map(contract.tables.map(item => [item.name, item]));
const tableColumns = {
  scholarly_provider_state: { provider: 'text', next_request_at: 'timestamp with time zone', cooldown_until: 'timestamp with time zone', consecutive_failures: 'integer', updated_at: 'timestamp with time zone' },
  scholarly_provider_leases: { provider: 'text', lease_id: 'uuid', cache_key: 'text', expires_at: 'timestamp with time zone' },
  scholarly_response_cache: { cache_key: 'text', provider: 'text', body: 'text', content_type: 'text', expires_at: 'timestamp with time zone', created_at: 'timestamp with time zone' },
};
const requiredConstraints = {
  scholarly_provider_state: ['scholarly_provider_state_consecutive_failures_check','scholarly_provider_state_pkey','scholarly_provider_state_provider_check'],
  scholarly_provider_leases: ['scholarly_provider_leases_cache_key_check','scholarly_provider_leases_pkey','scholarly_provider_leases_provider_fkey'],
  scholarly_response_cache: ['scholarly_response_cache_body_check','scholarly_response_cache_cache_key_check','scholarly_response_cache_content_type_check','scholarly_response_cache_pkey','scholarly_response_cache_provider_check'],
};
for (const [tableName, expected] of Object.entries(tableColumns)) {
  const table = tableMap.get(tableName);
  assert.ok(table, tableName + ' exists.');
  assert.equal(table.rls, true, tableName + ' must have RLS enabled.');
  assert.deepEqual(table.policies, 0, tableName + ' must not have RLS policies.');
  assert.equal(table.public_grant, false, tableName + ' must not grant directly to PUBLIC.');
  assert.deepEqual(table.direct_roles, null, tableName + ' must not grant direct access to application roles.');
  assert.deepEqual(Object.keys(table.columns).sort(), Object.keys(expected).sort(), tableName + ' columns match the migration.');
  for (const [column, type] of Object.entries(expected)) {
    assert.equal(table.columns[column].type, type, tableName + '.' + column + ' type matches.');
    assert.equal(table.columns[column].not_null, true, tableName + '.' + column + ' is NOT NULL.');
  }
  const constraints = table.constraints.map(item => item.name).sort();
  assert.deepEqual(constraints, requiredConstraints[tableName], tableName + ' required constraints match.');
}
assert.equal(tableMap.get('scholarly_provider_leases').constraints.find(x => x.name === 'scholarly_provider_leases_provider_fkey').delete_action, 'c',
  'Provider lease FK cascades only with provider state deletion.');
assert.ok(tableMap.get('scholarly_provider_leases').indexes.some(x => x.name === 'scholarly_provider_leases_expiry_idx' && x.definition.includes('(provider, expires_at)')));
assert.ok(tableMap.get('scholarly_response_cache').indexes.some(x => x.name === 'scholarly_response_cache_expiry_idx' && x.definition.includes('(expires_at)')));
const functionMap = new Map(contract.functions.map(item => [item.name, item]));
const functionExpectations = {
  reserve_scholarly_provider_slot: ['p_provider text, p_cache_key text, p_min_interval_ms integer, p_max_concurrent integer, p_lease_seconds integer','TABLE(allowed boolean, status text, retry_after_seconds integer, lease_id uuid)'],
  finish_scholarly_provider_request: ['p_provider text, p_lease_id uuid, p_status integer, p_retry_after_seconds integer','boolean'],
  read_scholarly_provider_cache: ['p_cache_key text','TABLE(body text, content_type text)'],
  write_scholarly_provider_cache: ['p_cache_key text, p_provider text, p_body text, p_content_type text, p_ttl_seconds integer','boolean'],
};
for (const [name, [identity, result]] of Object.entries(functionExpectations)) {
  const fn = functionMap.get(name);
  assert.ok(fn, name + ' exists.');
  assert.equal(fn.identity, identity, name + ' exact identity arguments match.');
  assert.equal(fn.result, result, name + ' exact result signature matches.');
  assert.equal(fn.security_definer, true, name + ' is SECURITY DEFINER.');
  assert.ok(Array.isArray(fn.config) && fn.config.includes('search_path=""'), name + ' pins empty search_path.');
  assert.ok(!['anon','authenticated','service_role'].includes(fn.owner), name + ' has a trusted owner.');
  assert.equal(fn.service_execute, true, name + ' is executable by service_role.');
  assert.equal(fn.anon_execute, false, name + ' is not executable by anon.');
  assert.equal(fn.authenticated_execute, false, name + ' is not executable by authenticated.');
  assert.equal(fn.public_execute, false, name + ' is not executable by PUBLIC.');
}
assert.equal(functionMap.get('finish_scholarly_provider_request').arguments.includes('DEFAULT 0'), true,
  'Finish RPC preserves the default Retry-After value.');
const normalizedBody = name => functionMap.get(name).body.toLowerCase().replace(/\s+/g, ' ');
for (const [name, snippets] of Object.entries({
  reserve_scholarly_provider_slot: ['status text', 'cooldown', 'deduplicated', 'concurrency_limited', 'not between 1 and 20'],
  finish_scholarly_provider_request: ['p_status = 429', 'p_status >= 500', 'consecutive_failures + 1 >= 3', "interval '15 seconds'"],
  read_scholarly_provider_cache: ['expires_at > clock_timestamp()'],
  write_scholarly_provider_cache: ['octet_length(p_body) > 2097152', 'p_ttl_seconds not between 1 and 21600', 'cache_rows > 10000'],
})) {
  for (const snippet of snippets) assert.ok(normalizedBody(name).includes(snippet), name + ' body retains ' + snippet + '.');
}
console.log('PASS: exact table definitions, checks, indexes, RLS, grants, RPC signatures, function security and migration ledger.');

const afterMigrationPreflight = preflight();
assert.equal(afterMigrationPreflight.migration_recorded, true);
assert.equal(afterMigrationPreflight.overall, 'RECORDED_REVIEW_FUNCTION_BODIES_AND_CATALOG_CONTRACTS');
assert.ok(afterMigrationPreflight.table_objects.every(item => item.status === 'PRESENT_REQUIRES_DEFINITION_REVIEW'));
assert.ok(afterMigrationPreflight.rpc_objects.every(item => item.status === 'SIGNATURE_SECURITY_GRANTS_COMPATIBLE_BODY_REVIEW_REQUIRED'));

let createdUser;
try {
  const anonymousKey = key('anon-authorization');
  const anonRead = await anon.rpc('read_scholarly_provider_cache', { p_cache_key: anonymousKey });
  expectDenied(anonRead, 'Anonymous RPC access');
  const anonTableRead = await anon.from('scholarly_provider_state').select('provider').limit(1);
  expectDenied(anonTableRead, 'Anonymous direct table access');

  const userEmail = 'coordination-' + randomUUID() + '@example.test';
  const userPassword = 'Local-' + randomUUID() + '-Aa9!';
  const createUser = await admin.auth.admin.createUser({ email: userEmail, password: userPassword, email_confirm: true });
  if (createUser.error || !createUser.data?.user?.id) throw new Error('Disposable authenticated user setup failed.');
  createdUser = createUser.data.user;
  const signIn = await anon.auth.signInWithPassword({ email: userEmail, password: userPassword });
  if (signIn.error || !signIn.data?.session?.access_token) throw new Error('Disposable authenticated user sign-in failed.');
  authenticated = createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: 'Bearer ' + signIn.data.session.access_token } },
  });
  const authRead = await authenticated.rpc('read_scholarly_provider_cache', { p_cache_key: key('auth-authorization') });
  expectDenied(authRead, 'Authenticated RPC access');
  const authTableRead = await authenticated.from('scholarly_provider_state').select('provider').limit(1);
  expectDenied(authTableRead, 'Authenticated direct table access');
  const serviceDirectRead = await admin.from('scholarly_provider_state').select('provider').limit(1);
  expectDenied(serviceDirectRead, 'service_role direct table access');
  console.log('PASS: PostgREST denies anon/authenticated RPCs and direct table access while keeping service-role table access denied.');
} finally {
  if (authenticated) await authenticated.auth.signOut().catch(() => {});
  if (createdUser?.id) await admin.auth.admin.deleteUser(createdUser.id).catch(() => {});
}

const cacheKey = key('cache-roundtrip');
assert.deepEqual(await requireSuccess(await admin.rpc('read_scholarly_provider_cache', { p_cache_key: cacheKey }), 'Cache miss'), []);
assert.equal(requireSuccess(await admin.rpc('write_scholarly_provider_cache', {
  p_cache_key: cacheKey, p_provider: 'crossref', p_body: '{"items":[{"DOI":"10.1000/synthetic"}]}',
  p_content_type: 'application/json', p_ttl_seconds: 60,
}), 'Cache write'), true);
const cached = requireSuccess(await admin.rpc('read_scholarly_provider_cache', { p_cache_key: cacheKey }), 'Cache read');
assert.deepEqual(row(cached), { body: '{"items":[{"DOI":"10.1000/synthetic"}]}', content_type: 'application/json' });
const shortKey = key('cache-expiry');
requireSuccess(await admin.rpc('write_scholarly_provider_cache', {
  p_cache_key: shortKey, p_provider: 'arxiv', p_body: '<feed/>',
  p_content_type: 'application/atom+xml', p_ttl_seconds: 1,
}), 'Short cache write');
await pause(1300);
assert.deepEqual(await requireSuccess(await admin.rpc('read_scholarly_provider_cache', { p_cache_key: shortKey }), 'Expired cache read'), []);
console.log('PASS: PostgREST cache miss/write/read/expiry.');

const duplicateKey = key('same-key-dedupe');
const firstLease = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'openalex', p_cache_key: duplicateKey, p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
}), 'Lease acquisition'));
assert.equal(firstLease.allowed, true);
assert.equal(firstLease.status, 'acquired');
const duplicate = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'openalex', p_cache_key: duplicateKey, p_min_interval_ms: 0, p_max_concurrent: 1, p_lease_seconds: 45,
}), 'Duplicate lease check'));
assert.equal(duplicate.allowed, false);
assert.equal(duplicate.status, 'deduplicated');
assert.equal(requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'openalex', p_lease_id: firstLease.lease_id, p_status: 204, p_retry_after_seconds: 0,
}), 'Lease completion'), true);
assert.equal(requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'openalex', p_lease_id: firstLease.lease_id, p_status: 204, p_retry_after_seconds: 0,
}), 'Repeated lease completion'), false);

const parallelLeases = await Promise.all(Array.from({ length: 8 }, (_, index) => admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'semantic_scholar', p_cache_key: key('parallel-' + index), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
})));
const parallelRows = parallelLeases.map((result, index) => row(requireSuccess(result, 'Parallel lease ' + index)));
assert.equal(parallelRows.filter(item => item.status === 'acquired').length, 2);
assert.equal(parallelRows.filter(item => item.status === 'concurrency_limited').length, 6);
for (const lease of parallelRows.filter(item => item.allowed)) {
  assert.equal(requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
    p_provider: 'semantic_scholar', p_lease_id: lease.lease_id, p_status: 204, p_retry_after_seconds: 0,
  }), 'Parallel lease cleanup'), true);
}
console.log('PASS: lease acquisition/completion, same-key deduplication and two-slot concurrency boundary.');

const paced = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'europe_pmc', p_cache_key: key('paced-1'), p_min_interval_ms: 5000, p_max_concurrent: 4, p_lease_seconds: 45,
}), 'Paced lease'));
const rateLimited = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'europe_pmc', p_cache_key: key('paced-2'), p_min_interval_ms: 5000, p_max_concurrent: 4, p_lease_seconds: 45,
}), 'Provider pacing'));
assert.equal(paced.allowed, true);
assert.equal(rateLimited.status, 'rate_limited');
assert.ok(rateLimited.retry_after_seconds >= 1);
requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'europe_pmc', p_lease_id: paced.lease_id, p_status: 204, p_retry_after_seconds: 0,
}), 'Paced lease cleanup');

const throttled = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'arxiv', p_cache_key: key('429-first'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), '429 cooldown reservation'));
requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'arxiv', p_lease_id: throttled.lease_id, p_status: 429, p_retry_after_seconds: 2,
}), '429 completion');
const cooldown = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'arxiv', p_cache_key: key('429-second'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), '429 cooldown check'));
assert.equal(cooldown.status, 'cooldown');
assert.ok(cooldown.retry_after_seconds >= 1 && cooldown.retry_after_seconds <= 2);
await pause(2200);
const afterCooldown = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'arxiv', p_cache_key: key('429-recovery'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), '429 recovery'));
assert.equal(afterCooldown.allowed, true);
requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'arxiv', p_lease_id: afterCooldown.lease_id, p_status: 200, p_retry_after_seconds: 0,
}), '429 recovery completion');

for (let attempt = 0; attempt < 3; attempt++) {
  const lease = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
    p_provider: 'crossref', p_cache_key: key('5xx-' + attempt), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
  }), '5xx reservation'));
  assert.equal(lease.allowed, true);
  requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
    p_provider: 'crossref', p_lease_id: lease.lease_id, p_status: 503, p_retry_after_seconds: 0,
  }), '5xx completion');
}
const serverCooldown = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'crossref', p_cache_key: key('5xx-cooldown'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), '5xx cooldown check'));
assert.equal(serverCooldown.status, 'cooldown');
await pause(15_200);
const recovered = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'crossref', p_cache_key: key('5xx-recovered'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), '5xx recovery'));
assert.equal(recovered.allowed, true);
requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'crossref', p_lease_id: recovered.lease_id, p_status: 200, p_retry_after_seconds: 0,
}), '5xx recovery completion');

const quotaSubject = key('quota-boundary');
const quotaResults = await Promise.all(Array.from({ length: 8 }, () => admin.rpc('consume_discovery_rate_limit', {
  p_subject_hash: quotaSubject, p_limit: 3, p_window_seconds: 600,
})));
const quotaRows = quotaResults.map((result, index) => row(requireSuccess(result, 'Distributed quota call ' + index)));
assert.equal(quotaRows.filter(item => item.allowed).length, 3);
assert.equal(quotaRows.filter(item => !item.allowed).length, 5);
console.log('PASS: provider pacing, Retry-After cooldown, server-failure circuit cooldown and shared quota boundary.');

const durableCacheKey = key('backup-cache');
requireSuccess(await admin.rpc('write_scholarly_provider_cache', {
  p_cache_key: durableCacheKey, p_provider: 'crossref', p_body: '{"backup":"synthetic"}',
  p_content_type: 'application/json', p_ttl_seconds: 3600,
}), 'Backup cache seed');
const backupLease = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'crossref', p_cache_key: key('backup-lease'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), 'Backup lease seed'));
const dump = execFileSync('docker', [
  'exec', dbContainer, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--data-only', '--column-inserts',
  '--no-owner', '--no-privileges',
  '--table=public.scholarly_provider_state',
  '--table=public.scholarly_provider_leases',
  '--table=public.scholarly_response_cache',
], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
assert.ok(dump.includes('scholarly_provider_state') && dump.includes('scholarly_response_cache'), 'Disposable coordination backup contains the selected tables.');
psql('TRUNCATE public.scholarly_provider_leases, public.scholarly_response_cache, public.scholarly_provider_state;\n', { singleTransaction: true });
psql(dump, { singleTransaction: true });
const restoredCache = row(requireSuccess(await admin.rpc('read_scholarly_provider_cache', { p_cache_key: durableCacheKey }), 'Restored cache read'));
assert.equal(restoredCache.body, '{"backup":"synthetic"}');
const restoredLease = row(requireSuccess(await admin.rpc('reserve_scholarly_provider_slot', {
  p_provider: 'crossref', p_cache_key: key('backup-lease'), p_min_interval_ms: 0, p_max_concurrent: 2, p_lease_seconds: 45,
}), 'Restored lease dedupe'));
assert.equal(restoredLease.status, 'deduplicated');
requireSuccess(await admin.rpc('finish_scholarly_provider_request', {
  p_provider: 'crossref', p_lease_id: backupLease.lease_id, p_status: 204, p_retry_after_seconds: 0,
}), 'Restored lease completion');
console.log('PASS: disposable coordination-state dump, truncate, restore and post-restore RPC checks.');

const replay = JSON.parse(await readFile(initialManifestPath, 'utf8'));
assert.equal(replay.some(item => item.source === migrationName), false);
const entry = { source: migrationName, version: '20261128145000', sha256: expectedSha };
const insertAt = plan.canonical_local_order.indexOf(migrationName);
assert.ok(insertAt >= 0);
replay.splice(insertAt, 0, entry);
await writeFile(initialManifestPath, JSON.stringify(replay, null, 2) + '\n');
assert.deepEqual(replay.map(item => item.source), plan.canonical_local_order);
const migrationList = execFileSync('supabase', ['migration', 'list'], { cwd: projectDir, encoding: 'utf8' });
assert.ok(migrationList.includes('20261128145000'), 'Local migration history must include the exact source version.');
const finalPreflight = preflight();
assert.equal(finalPreflight.migration_recorded, true);
assert.equal(finalPreflight.overall, 'RECORDED_REVIEW_FUNCTION_BODIES_AND_CATALOG_CONTRACTS');
console.log('PASS: exact source migration reconciled in disposable local ledger and final read-only preflight.');
