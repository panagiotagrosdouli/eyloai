# EYRA conversation saving checkpoint — 2026-11-13

## Provenance and scope

- New development branch: `codex/eyra-conversation-saving-20261113`, created from latest verified `main` at `83a647f9d07d147c1d212996c852ef122f48b296`.
- Prior conversation foundation was merged as PR #398. Do not reuse its branch or reopen it.
- This incremental slice uses the **existing** `eyra_conversations` and `eyra_messages` tables unchanged.
- This slice exposes an authenticated write API; it does **not** hook generation or the browser Command Center to automatic saving yet. It is deliberately one complete, bounded server-side capability.

## Implementation contract

- `supabase/migrations/20261113110000_eyra_conversation_writes.sql`: two new functions, `eyra_create_conversation(uuid,text)` and `eyra_append_message(uuid,uuid,text,text)`. Both use SECURITY INVOKER and execute only as the caller's authenticated RLS identity; no service-role access is granted.
- Create is idempotent by caller-supplied conversation UUID. Replaying exactly the same title returns the existing owner record; conflicting reuse returns an error. Foreign IDs are indistinguishable from absent records.
- Append takes a caller-stable message UUID, parent UUID, explicit allowed role, and text-only content. Parent row locking (`FOR UPDATE`) atomically assigns `max(sequence_number)+1`, maintains deterministic message order, and serializes appenders for the same conversation. The existing composite owner/parent FK and RLS remain the database authority.
- Exact retries return the original message row **without** a second insert or version update. Reusing the same message UUID for different role/content fails. Database transactions roll back failed inserts and parent updates together.
- `POST /api/eyra-conversation-write` authenticates the Supabase user bearer, validates all fields and lengths, and forwards only to the configured Supabase project using its publishable key plus the user JWT. It never uses a service-role key or a model provider. Actions: `{action:"create",id,title}` and `{action:"append",conversation_id,message_id,role,content:{text}}`. Stable 401/400/404/409/503 errors; unconfirmed saves require retry with the **same** UUID.
- The GET-only history API from PR #398 is unchanged.

## Verification and blockers

- `tests/eyra-conversation-write.test.mjs` mocks Supabase Auth and PostgREST. Tests cover valid calls, both owners' bearer forwarding, missing/invalid sessions, malformed IDs/roles/content, foreign/missing equivalence, retry collisions, and ambiguous network failure.
- `tests/integration/eyra-conversation-writes-postgres.sql` checks real PostgreSQL owner RLS, two-user access, creation and append retries, invalid inputs, role grants and atomic rollback. The disposable Docker runner also opens two independent sessions to assert contiguous unique sequence numbers under concurrent appends.
- Relevant CI: `npm run check` and `python3 scripts/integration/test-local-postgres.py` run under EYLO Quality Gate. **Only call these passing when the new PR's actual completed CI run confirms them.**
- BLOCKED: migration is not applied to any authorized hosted staging project; hosted Supabase Auth/PostgREST acceptance is not verified.
- NOT IMPLEMENTED: automatic saving of generated responses, browser refresh hydration, client-side retry queue, cancellation, streaming, conversation deletion UI. These require separate tested slices.
- No production migration, production deployment, unrelated Supabase project, real provider credentials or production data writes.

## Next smallest task

After confirming current CI and only after separately authorized staging has applied the reviewed migration, integrate browser conversation creation and append into the existing Command Center with stable request/message UUIDs and explicit persistence-error states. Do not claim auto-saving or page-refresh restore until tested. Keep the new PR Draft and unmerged.


## Follow-up: Command Center user-message persistence (2026-11-13)

Starting PR #400 HEAD verified: `0360657fd288d61e2be39b190d195cd1fcbabf65` (Draft, open, unmerged). Subsequent commits are on the same branch, not PR #398's merged branch.

### New implementation

- `src/lib/eyra-conversation-saving.mjs`: client-side transport for existing `POST /api/eyra-conversation-write`. Requests a validated Supabase user session, confirms the returned conversation ID and exact message ID/role/content/sequence before considering a message saved, and never uses server keys. Supports stable caller UUIDs and separates definitive failures from ambiguous/unconfirmed writes. Replays original IDs on retry, relying on the existing transactional RPC deduplication.
- `src/components/eyra/EyraCommandCenter.jsx`: on submission, immediately displays the user message and independently begins saving. One conversation UUID/title is kept across that session's messages; each user message gets its own UUID before submission, retained inside the existing 30-message `sessionStorage` snapshot for later retry and session recovery. A per-message in-flight lock avoids duplicate browser calls. A verified owner ID is stored for each message and cross-account retries are blocked.
- UI visibly distinguishes `saving`, `saved`, `failed`, `unconfirmed`, and `local-only`. Messages remain visible and retryable when unconfirmed or failed, including if the server never responds. A legacy session-only record lacking a UUID is explicitly local-only. The previous browser-session history remains intact. Clearing the Command Center resets the active conversation identifier **locally only**; this does not delete server records.
- Current EYRA model responses, cancellation, sources, Idea Vault insight saving, and other EYLO integrations are not altered. **Assistant-response persistence is not implemented.** The Command Center does **not** load authenticated remote history yet; the existing session snapshot still supplies local history.

### Test and acceptance boundaries

- `tests/eyra-command-saving.test.mjs`: 7 tests for deterministic UUIDs across retries, required server confirmation, foreign-account retry rejection, no unauthenticated writes, network interruption, 4xx vs 5xx state classification, and rejecting malformed messages before transport.
- `tests/eyra-command-saving-ui.test.mjs`: 4 source-backed component contract regressions for user-message saving hooks, in-flight locking, status/retry UI, and preservation of session history / cancellation / other EYLO paths. These are source-level UI guards, not full browser-render interaction tests.
- Existing `tests/eyra-conversation-write.test.mjs` supplies mocked backend Auth/RPC checks, and existing disposable PostgreSQL CI checks enforce RLS, ownership, concurrent sequence allocation and retry idempotency.
- **Check the current PR head GitHub Actions results before reporting tests passing.** No hosted Supabase Auth, staging schema or end-to-end persisted production UI acceptance is claimed.
- Existing database schema and migrations unchanged; no hosted or production migrations and no production deployment performed.

### Next smallest task

In a separately authorized staging environment with the EYRA schema and write RPCs installed, validate one signed-in user's actual Command Center create+save+retry cycle and confirm it is invisible to a second user. Then, as a separate development slice, hydrate saved conversation history in the Command Center on refresh and add fully rendered component interaction tests. Keep PR #400 Draft until reviewed.
