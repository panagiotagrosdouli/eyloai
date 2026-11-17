-- EYRA metadata-only SQL preflight. No user rows, credentials, DDL or writes.
WITH expected(table_name) AS (
  VALUES ('eyra_conversations'), ('eyra_messages'),
         ('eyra_agent_runs'), ('eyra_agent_actions')
),
observed AS (
 SELECT e.table_name,
        (c.oid IS NOT NULL) AS present,
        coalesce(c.relrowsecurity, false) AS rls_enabled,
        coalesce(has_table_privilege('authenticated', c.oid, 'SELECT'), false) AS authenticated_select,
        coalesce(has_table_privilege('authenticated', c.oid, 'INSERT'), false) AS authenticated_insert,
        coalesce(has_table_privilege('authenticated', c.oid, 'UPDATE'), false) AS authenticated_update,
        coalesce(has_table_privilege('authenticated', c.oid, 'DELETE'), false) AS authenticated_delete,
        coalesce(has_table_privilege('anon', c.oid, 'SELECT'), false)
          OR coalesce(has_table_privilege('anon', c.oid, 'INSERT'), false)
          OR coalesce(has_table_privilege('anon', c.oid, 'UPDATE'), false)
          OR coalesce(has_table_privilege('anon', c.oid, 'DELETE'), false) AS anon_access,
        coalesce(has_table_privilege('service_role', c.oid, 'INSERT'), false)
          AND coalesce(has_table_privilege('service_role', c.oid, 'UPDATE'), false)
          AND coalesce(has_table_privilege('service_role', c.oid, 'DELETE'), false) AS service_role_write
 FROM expected e
 LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', e.table_name))
),
snapshot AS (
 SELECT p.oid IS NOT NULL AS present,
        NOT p.prosecdef AS security_invoker,
        coalesce(has_function_privilege('authenticated',p.oid,'EXECUTE'),false) AS authenticated_execute,
        coalesce(has_function_privilege('anon',p.oid,'EXECUTE'),false) AS anon_execute
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname='save_eyra_conversation_snapshot'
   AND pg_get_function_identity_arguments(p.oid) = 'p_title text, p_messages jsonb, p_snapshot_id uuid'
)
SELECT jsonb_build_object(
 'schema_version', 1,
 'tables', (SELECT jsonb_object_agg(table_name,jsonb_build_object(
  'present',present,'rls_enabled',rls_enabled,'authenticated_select',authenticated_select,
  'authenticated_insert',authenticated_insert,'authenticated_update',authenticated_update,
  'authenticated_delete',authenticated_delete,'anon_access',anon_access,
  'service_role_write',service_role_write)) FROM observed),
 'snapshot_rpc', (SELECT row_to_json(snapshot)::jsonb FROM snapshot LIMIT 1),
 'recorded_versions', (SELECT coalesce(jsonb_agg(version::text ORDER BY version), '[]'::jsonb)
  FROM supabase_migrations.schema_migrations
  WHERE version::text IN ('20261113090000','20261113114924','20261113120556','20261115233000'))
) AS eyra_schema_report;
