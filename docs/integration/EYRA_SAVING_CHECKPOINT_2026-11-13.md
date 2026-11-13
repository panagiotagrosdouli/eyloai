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
