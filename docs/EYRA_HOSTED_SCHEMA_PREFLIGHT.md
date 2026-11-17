# EYRA schema readiness preflight — review only

This is a **read-only catalog inventory**, not a migration, staging authorization, production readiness declaration or two-user RLS proof. A positive result never says production is ready.

## Where the EYRA backend stands

The live EYLO project audited on 17 November 2026 lacks all four conversation/agent tables, the idempotent snapshot function, and all four recorded migration versions. This is a real Supabase metadata check, not a mock.

## Safe staging acceptance workflow

1. Identify an independently authorized **staging** Supabase project and verify its URL. Never substitute production credentials, real accounts, or the unrelated project.
2. Reconcile the **full hosted migration history** and current schema. The repository migration-review manifest is **local replay only** and expressly forbids remote application. Do not apply the historical SQL files to staging or production blindly.
3. Review backups, extensions, the exact SQL dependencies, rollback, and table grants before any separately authorized staging migration.
4. In the authorized staging SQL editor execute the **read-only** `scripts/eyra-schema-readiness.sql`. Save only the `eyra_schema_report` JSON value privately; never commit customer data or credentials.
5. Inspect offline with `node scripts/check-eyra-schema-readiness.mjs path/to/private-report.json`. An exit code of 1 means the schema preflight fails. Exit 0 means **metadata only**, still not a GO for a live release.
6. With **two disposable real staging JWT identities**, separately test authenticated snapshot save/reload, exact UUID idempotent retry, rename versioning, deletion cascade, A-to-B read/update/delete denial, source metadata boundaries, and server-role-only agent ledger writes.
7. Review Supabase security advisors and PostgREST grants, then obtain a separate owner-reviewed release decision after SMTP, OpenAI quota, staging source quality and rollback verification.

**No hidden authorization:** The evaluator always returns `remote_application_authorized: false` and `production_release_approved: false`. Even an otherwise correct schema returns `HOSTED_TWO_ACCOUNT_ACCEPTANCE_REQUIRED`. Postgres `relrowsecurity` and privilege checks alone cannot prove that row policies enforce account isolation.

Tracking: issue #309 (release gate) and #462 (EYRA durable workflows).
