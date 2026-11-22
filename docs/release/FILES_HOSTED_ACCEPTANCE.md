# Real Files acceptance on isolated staging

This opt-in runner uses Supabase Auth, PostgREST and Storage HTTP endpoints. It creates two small text versions for each disposable account, confirms exact downloaded bytes, reloads file/version metadata, verifies foreign metadata reads/updates/deletion and version insertion are denied, checks foreign Storage upload/download/deletion, then verifies owner cleanup and version cascade. A success status without deleted bytes cannot pass cleanup. A backend500 cannot pass as authorization denial.

## Required environment

Configure privately, without committing tokens or shell transcripts:

- `EYLO_STAGING_SUPABASE_URL`: canonical `https://<staging-ref>.supabase.co`.
- `EYLO_STAGING_PROJECT_REF`: the same verified staging ref.
- `EYLO_STAGING_PUBLISHABLE_KEY`: publishable/anon key, never service-role.
- `EYLO_STAGING_ACCESS_JWT_A`, `EYLO_STAGING_ACCESS_JWT_B`: current genuine signed-in user sessions for two distinct consenting disposable staging accounts.
- `EYLO_STAGING_AB_ACK=DISPOSABLE_STAGING_ACCOUNTS_ONLY`.
- `EYLO_STAGING_FILES_ACK=DISPOSABLE_STAGING_FILES_ONLY`.

Run `node scripts/files-hosted-ab.mjs` from a trusted network-enabled environment. The existing production-ref guard rejects EYLO production before any network request. Both identities are verified against Auth before any writes. Only random IDs/paths generated in this invocation are modified. This is not a production account-testing tool.

The existing `eylo_files`, `eylo_file_versions` contracts and private `eylo-files` bucket must be deployed. The runner performs no DDL, account creation or billing calls. It does not check project links, signed URLs, large uploads, browser behavior or encryption; complete those separate acceptance steps as well.

## Failure and cleanup

The CLI emits a generic failure, never upstream payloads, tokens or object paths. Inspect only the disposable staging records privately. Cleanup is attempted for both owners, including a generated foreign-upload probe if an insecure Storage policy admitted it. If Storage cleanup fails, metadata is retained for recovery; the runner fails rather than reporting success. Do not delete customer objects to reset the test.

## Evidence limits and current provisioning

The eight unit tests use a synthetic HTTP service to verify the runner's safety and failure detection. They are not hosted Supabase acceptance. A real result requires actual staging and genuine sessions.

On22 November2026 the user selected the EYLO organization `ygpcvnqrewkjjxtkyvvv`. Supabase quoted a standalone project at$0/month, but creation failed because the administrator had reached the two-free-project limit. No project was created. The user then approved Pro from$25/month and temporary branch compute at$0.01344/hour plus usage. The branch call with the documented confirmation ID failed schema validation; a subsequent call without that argument was cancelled by the client and explicitly reported that nothing ran. No branch or plan upgrade is established. Connected tools expose no plan-upgrade action; the organization billing dashboard is the next account dependency. No further cost approval is needed for those exact approved costs, subject to any different quote or scope.

Product payments are explicitly out of scope at the user's latest direction. Keep checkout and billing activation disabled. Infrastructure staging approval is separate from product payments.
