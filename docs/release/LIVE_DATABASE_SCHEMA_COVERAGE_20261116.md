# EYLO production schema coverage — read-only snapshot, 2026-11-16

**Environment:** Confirmed connected EYLO production Supabase project `kbzjngpzxpniaumlupaa`. **Method:** Read-only `list_tables` metadata from schema `public`; compare table names with `supabase_entities` referenced in `docs/integration/product-matrix.json` at main. No user rows, migration, policy changes or DDL were executed.

- Declared unique source-backed entities across 77-product matrix: **43**.
- Found by exact `public` table name: **29**.
- Not present in current live `public` table listing: **14**.
- All 34 listed existing public tables reported RLS enabled; this does not establish RLS policy correctness or data isolation.
- 19 migration history entries were observed; absence of a table is not permission to apply the matching source migration to production.

| Missing public table | Products referencing it |
| --- | --- |
| `eyra_conversations` | #24, #31 |
| `eyra_messages` | #5, #24, #31 |
| `grant_applications` | #31 |
| `eylo_directory` | #31, #34 |
| `eylo_teams` | #31, #32 |
| `eylo_team_invites` | #31, #32 |
| `eylo_team_members` | #31, #32 |
| `eylo_connections` | #31, #34, #53 |
| `eylo_community_posts` | #31, #35 |
| `eylo_peer_submissions` | #31, #53 |
| `eylo_peer_reviews` | #31, #53 |
| `eylo_feedback` | #31, #39, #46 |
| `eylo_api_tokens` | #31, #76 |
| `meeting_participants` | #33 |

**Interpretation:** These are exact naming mismatches between the source inventory and current production metadata. A feature may use another storage mechanism or be intentionally disabled, but no associated workflow is accepted without verification. This is **not** a declaration that every missing table should be installed as-is or that all existing tables are correctly configured.

**Safe resolution:** Reconcile actual current migration files with production history, inspect source code expectations and dependencies, compare schemas on a separately authorized staging project, test migrations there in sequence, verify grants/RLS/storage with two disposable accounts and observe full backend/frontend workflows. Do **not** apply production DDL or synchronize production by assumption.

**Release decision:** NO-GO for all-77 acceptance. This snapshot supplements, but cannot replace, the detailed per-product matrix and independent acceptance ledger.
