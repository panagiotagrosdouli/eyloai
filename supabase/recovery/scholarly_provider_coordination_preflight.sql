-- Read-only catalog preflight for migration 20261128145000.
-- Safe on production: SELECT only; does not inspect row data or mutate schema.
-- If any object is PARTIAL/INCOMPATIBLE, stop and reconcile manually. Never replay
-- the non-idempotent migration over existing objects.
with
expected_tables(table_name, expected_columns, expected_constraint_names, expected_index_names) as (
 values
 ('scholarly_provider_state',
  jsonb_build_object('provider','text','next_request_at','timestamp with time zone','cooldown_until','timestamp with time zone','consecutive_failures','integer','updated_at','timestamp with time zone'),
  array['scholarly_provider_state_pkey','scholarly_provider_state_provider_check','scholarly_provider_state_consecutive_failures_check']::text[],
  array[]::text[]),
 ('scholarly_provider_leases',
  jsonb_build_object('provider','text','lease_id','uuid','cache_key','text','expires_at','timestamp with time zone'),
  array['scholarly_provider_leases_pkey','scholarly_provider_leases_provider_fkey','scholarly_provider_leases_cache_key_check']::text[],
  array['scholarly_provider_leases_expiry_idx']::text[]),
 ('scholarly_response_cache',
  jsonb_build_object('cache_key','text','provider','text','body','text','content_type','text','expires_at','timestamp with time zone','created_at','timestamp with time zone'),
  array['scholarly_response_cache_pkey','scholarly_response_cache_cache_key_check','scholarly_response_cache_provider_check','scholarly_response_cache_body_check','scholarly_response_cache_content_type_check']::text[],
  array['scholarly_response_cache_expiry_idx']::text[])
),
expected_functions(function_name, identity_args, result_type, default_arg_count) as (
 values
 ('reserve_scholarly_provider_slot','text, text, integer, integer, integer','TABLE(allowed boolean, status text, retry_after_seconds integer, lease_id uuid)',0),
 ('finish_scholarly_provider_request','text, uuid, integer, integer','boolean',1),
 ('read_scholarly_provider_cache','text','TABLE(body text, content_type text)',0),
 ('write_scholarly_provider_cache','text, text, text, text, integer','boolean',0)
),
table_inventory as (
 select e.*,c.oid,c.relrowsecurity,c.relforcerowsecurity,
  coalesce((select jsonb_object_agg(a.attname,jsonb_build_object(
   'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
   'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'{}'::jsonb) actual_columns,
  coalesce((select jsonb_agg(jsonb_build_object('name',con.conname,'type',con.contype,'definition',pg_get_constraintdef(con.oid,true)) order by con.conname)
   from pg_constraint con where con.conrelid=c.oid),'[]'::jsonb) constraints,
  coalesce((select jsonb_agg(ix.indexname order by ix.indexname)
   from pg_indexes ix where ix.schemaname='public' and ix.tablename=e.table_name),'[]'::jsonb) actual_index_names,
  coalesce((select jsonb_agg(jsonb_build_object('name',ix.indexname,'definition',ix.indexdef) order by ix.indexname)
   from pg_indexes ix where ix.schemaname='public' and ix.tablename=e.table_name),'[]'::jsonb) indexes,
  coalesce((select jsonb_agg(r.rolname order by r.rolname) from pg_roles r
   where r.rolname in ('anon','authenticated','service_role')
    and has_table_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),'[]'::jsonb) direct_granted_roles,
  coalesce((select bool_or(x.grantee=0) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x),false) public_has_table_grant
 from expected_tables e
 left join pg_class c on c.relnamespace='public'::regnamespace and c.relname=e.table_name and c.relkind='r'
),
table_checks as (
 select t.*,
  (select coalesce(jsonb_agg(x.key),'[]'::jsonb) from jsonb_object_keys(t.expected_columns) as x(key) where not (t.actual_columns ? x.key)) missing_columns,
  (select coalesce(jsonb_agg(jsonb_build_object('name',x.key,'expected_type',x.value,'actual',t.actual_columns->x.key)),'[]'::jsonb)
    from jsonb_each_text(t.expected_columns) as x(key,value)
    where t.actual_columns ? x.key and t.actual_columns->x.key->>'type'<>x.value) type_mismatches,
  (select coalesce(jsonb_agg(x.key),'[]'::jsonb) from jsonb_object_keys(t.actual_columns) as x(key) where not (t.expected_columns ? x.key)) extra_columns,
  (select coalesce(jsonb_agg(x.name),'[]'::jsonb) from unnest(t.expected_constraint_names) x(name)
    where not exists(select 1 from pg_constraint c where c.conrelid=t.oid and c.conname=x.name)) missing_constraints,
  (select coalesce(jsonb_agg(x.name),'[]'::jsonb) from unnest(t.expected_index_names) x(name)
    where not exists(select 1 from pg_indexes i where i.schemaname='public' and i.tablename=t.table_name and i.indexname=x.name)) missing_indexes
 from table_inventory t
),
function_inventory as (
 select e.*,to_regprocedure(format('public.%I(%s)',e.function_name,e.identity_args)) function_oid
 from expected_functions e
),
function_checks as (
 select f.*,p.oid,p.proowner,p.prolang,p.prosecdef,p.proconfig,p.pronargdefaults,
  case when p.oid is not null then pg_get_function_result(p.oid) end actual_result,
  case when p.oid is not null then pg_get_userbyid(p.proowner) end owner_name,
  case when p.oid is not null then has_function_privilege('service_role',p.oid,'EXECUTE') end service_execute,
  case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end anon_execute,
  case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end authenticated_execute,
  case when p.oid is not null then coalesce((select bool_or(a.grantee=0 and a.privilege_type='EXECUTE')
   from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),false) end public_execute,
  case when p.oid is not null then coalesce('search_path=""'=any(p.proconfig),false) end empty_search_path
 from function_inventory f left join pg_proc p on p.oid=f.function_oid
),
reports as (
 select jsonb_build_object('name',table_name,
  'status',case when oid is null then 'MISSING'
   when jsonb_array_length(type_mismatches)>0 or jsonb_array_length(extra_columns)>0 or relrowsecurity is distinct from true
    or jsonb_array_length(direct_granted_roles)>0 or public_has_table_grant then 'INCOMPATIBLE'
   when jsonb_array_length(missing_columns)>0 or jsonb_array_length(missing_constraints)>0 or jsonb_array_length(missing_indexes)>0 then 'PARTIAL'
   else 'PRESENT_REQUIRES_DEFINITION_REVIEW' end,
  'missing_columns',missing_columns,'type_mismatches',type_mismatches,'extra_columns',extra_columns,
  'columns_and_defaults',actual_columns,'rls_enabled',relrowsecurity,'force_rls',relforcerowsecurity,
  'missing_constraint_names',missing_constraints,'constraint_definitions',constraints,
  'missing_index_names',missing_indexes,'indexes',indexes,
  'roles_with_direct_table_privileges',direct_granted_roles,'public_has_table_grant',public_has_table_grant
 ) obj from table_checks
),
function_reports as (
 select jsonb_build_object('name',function_name,'identity_arguments',identity_args,
  'status',case when function_oid is null then 'MISSING'
   when actual_result<>result_type or prosecdef is distinct from true
    or empty_search_path is distinct from true or owner_name in ('anon','authenticated','service_role')
    or pronargdefaults<>default_arg_count or service_execute is distinct from true
    or anon_execute is distinct from false or authenticated_execute is distinct from false
    or public_execute is distinct from false then 'INCOMPATIBLE'
   else 'SIGNATURE_SECURITY_GRANTS_COMPATIBLE_BODY_REVIEW_REQUIRED' end,
  'expected_result',result_type,'actual_result',actual_result,
  'security_definer',prosecdef,'empty_search_path',empty_search_path,'owner',owner_name,
  'default_argument_count',pronargdefaults,'service_role_execute',service_execute,
  'anon_execute',anon_execute,'authenticated_execute',authenticated_execute,'public_execute',public_execute
 ) obj from function_checks
),
migration_recorded as (select exists(select 1 from supabase_migrations.schema_migrations where version='20261128145000') recorded)
select jsonb_pretty(jsonb_build_object(
 'migration_version','20261128145000',
 'migration_recorded',(select recorded from migration_recorded),
 'table_objects',(select jsonb_agg(obj order by obj->>'name') from reports),
 'rpc_objects',(select jsonb_agg(obj order by obj->>'name') from function_reports),
 'service_role_public_schema_usage',has_schema_privilege('service_role','public','USAGE'),
 'overall',case
  when not (select recorded from migration_recorded)
   and (select bool_and(oid is null) from table_inventory)
   and (select bool_and(function_oid is null) from function_inventory)
   then 'SAFE_CANDIDATE_ONLY_AFTER_STAGING_AND_BACKUP'
  when (select recorded from migration_recorded)
   and (select bool_and(status='PRESENT_REQUIRES_DEFINITION_REVIEW') from (select obj->>'status' status from reports) x)
   and (select bool_and(status='SIGNATURE_SECURITY_GRANTS_COMPATIBLE_BODY_REVIEW_REQUIRED') from (select obj->>'status' status from function_reports) x)
   then 'RECORDED_REVIEW_FUNCTION_BODIES_AND_CATALOG_CONTRACTS'
  else 'STOP_PARTIAL_OR_INCOMPATIBLE_STATE_REQUIRES_MANUAL_RECONCILIATION'
 end
));
