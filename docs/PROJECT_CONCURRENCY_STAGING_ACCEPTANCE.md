# Project concurrency staging acceptance

## Implementation and schema evidence

The project repository implements updateIfUnchanged(id, patch, expectedUpdatedDate) with owner user_id, id and updated_date predicates. Zero-row responses fail with ENTITY_CONFLICT.

The original migration supabase/migrations/20260803_eylo_core_entities.sql defines a BEFORE UPDATE trigger projects_set_updated_date which calls public.set_updated_date(). That routine assigns a transaction timestamp to updated_date. Repository inspection does not prove the trigger was installed in the actual production tenant. Two writes in one transaction may share the same timestamp; a timestamp is not a formal numeric revision.

## Staging-only acceptance

Run: npm run test:e2e:project-concurrency

Configure the following via protected local/CI environment (never commit passwords or paste them in chat):

- EYLO_STAGING_SUPABASE_REF: exact 20-character **staging** reference, not the production reference.
- EYLO_STAGING_SUPABASE_URL: must match https://REF.supabase.co.
- EYLO_STAGING_SUPABASE_ANON_KEY: publishable/anon key, NOT a service-role key.
- EYLO_STAGING_TEST_OWNER_EMAIL and EYLO_STAGING_TEST_OWNER_PASSWORD: disposable owner credentials.
- EYLO_STAGING_TEST_OUTSIDER_EMAIL and EYLO_STAGING_TEST_OUTSIDER_PASSWORD: distinct disposable account.
- EYLO_STAGING_ALLOW_EPHEMERAL_WRITES=YES: explicit approval to create/update/delete one disposable test project.

The runner validates a live schema trigger and separate auth sessions, owner-only RLS, stale task/evidence writes, an EYRA-style late update, network failure and a fresh retry. It cleans up only the project it created. If cleanup fails it reports that manual staging cleanup is needed (no ID leaked to logs).

The guard refuses the known EYLO production ref, but a different-looking ref is NOT sufficient evidence that the tenant is authorized staging. Confirm ownership and purpose first.

Cross-user collaborative updates are not supported by the current private-owner RLS model. The test uses two independent sessions of the same test owner for conflicts and an unrelated test user to verify denial. Do not weaken RLS for shared-project simulation.

## Browser acceptance

1. Open the same staging project in two tabs, change the same notes field, save tab A then tab B.
2. Tab B must keep unsaved text, show both values and require a human choice for overlapping edits. Preparing a reconciliation must not save automatically.
3. After preparing, review the editor and explicitly save again. A second intervening write must cause another conflict.
4. Repeat with tasks, evidence annotations and an EYRA analysis that finishes after human edits.
5. Simulate a network interruption and ensure the local draft remains editable; retry only after reconnection.
6. Verify a different user is denied access to the private project even when their client knows the UUID.

GitHub CI's mocked browser tests are not evidence of these real staging scenarios.

## Read-only database trigger inspection

An authorized operator can inspect the deployed trigger, without changing data:

    select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    where t.tgrelid = 'public.projects'::regclass and not t.tgisinternal;

    select pg_get_functiondef('public.set_updated_date()'::regprocedure);

Check that the trigger is enabled on the correct tenant. Production database migrations require review and separate approval.