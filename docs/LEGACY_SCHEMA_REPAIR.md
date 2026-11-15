# Legacy workspace schema compatibility repair

Owner-identified and connector-confirmed project: EYLO `kbzjngpzxpniaumlupaa` (`eyloai`). Read-only schema inspection on 2026-11-15 found legacy top-level business columns, no canonical created_date/updated_date, and profiles keyed only by id. The current browser reads/writes JSONB data and user_id. Its schema therefore cannot support profile and core workspace saves even when authentication succeeds.

## Reviewed migration

20261115190203_bridge_legacy_workspace_schema.sql is an additive compatibility bridge for the eight observed legacy core tables. It preserves original columns, values, ownership policies and grants. It adds canonical JSON/timestamp fields and a matching profile user_id, backfills without losing unknown JSON extensions, and synchronizes old/new client writes. Only observed timestamp-only trigger functions are paused during backfill and restored to their exact prior states within the transaction. Original timestamps remain unchanged by backfill. No tables or rows are deleted or rebuilt. Fresh canonical schemas are skipped; repeat application is idempotent.

The serializer retains canonical arrays/objects over their legacy text representations while keeping row ID and version trusted. This companion code change requires its PR deployment; the additive database bridge itself preserves compatibility with both client generations.

## Evidence before hosted repair

- Disposable PostgreSQL with the observed legacy schemas and seeded rows passed all 24 selected canonical migrations and the entire existing SQL regression runner.
- Backfill preservation, timestamps, always-enabled trigger restoration, old-column edits, canonical saves to all eight tables, profile upsert, structured arrays, identity protection and outsider RLS denial passed.
- npm run check passed: imports, both TypeScript projects, lint, 770 tests and production build.
- Existing live profiles: exact count 2. Preservation fingerprint over original profile fields (excluding added aliases/JSON) was b4f20e84177939fda8966b69eff5905f. No names/emails/content were exported.

## Rollback and verification

The migration is atomic: any failing statement rolls back all schema, data and trigger-state changes. After success, compare the profile preservation fingerprint and counts, inspect schema/trigger state and run security advisors. Do not drop the new columns, JSON or original columns. An older application remains compatible with the bridge enabled. If a defect appears after new writes, preserve both representations and forward-fix the narrow trigger/serializer defect; do not erase canonical-only fields or roll back saved records. Any destructive reversal requires a separate data-preserving plan and explicit approval.

Missing Notes/Files/Life/learning tables and missing AI/provider configuration are separate dependencies. This bridge alone does not establish full platform acceptance or authorize replaying all historical migrations against production. The local replay manifest still explicitly authorizes disposable replay only.


## Hosted result and approval boundary

The compatibility bridge was applied successfully through Supabase's migration API on the owner-confirmed EYLO project. Immediate verification returned 2 profiles, 8 bridge triggers, 16 canonical metadata columns, valid profile aliases, and the identical preservation fingerprint b4f20e84177939fda8966b69eff5905f. Security advisors returned the same two pre-existing notices (service-only quota RLS without user policies, and password protection configuration); no new notice was introduced by the bridge.

The separate 19-source workspace restoration bundle was NOT applied. Automatic approval review rejected it because of its broad production impact (new tables, functions, triggers, grants and Storage configuration) without specific authorization. The exact reviewed sources and hashes are in supabase/legacy-workspace-restoration-plan.json. The account deletion proposal, billing changes, scheduler and already-installed quota are explicitly excluded. Approval must identify this curated bundle before retrying; do not bypass the rejection by splitting it into smaller tool calls.

The exact proposed bundle passed an independent disposable PostgreSQL run with the observed legacy schema and existing operational/billing prerequisites, without replaying the old incompatible core migration. It passed all relevant workspace, learning, file metadata, export, RLS and concurrency regressions. Account deletion tests remain active in the normal full replay but are deliberately absent from the proposed production bundle.

To activate the proposed missing workspace tables, obtain explicit approval for the reviewed plan, recheck current hosted schema/migration history for concurrent changes, apply the bundle atomically, and rerun schema/advisor and non-persistent transaction checks. Leave newly added schema/data in place on application rollback; do not drop stored user content.
