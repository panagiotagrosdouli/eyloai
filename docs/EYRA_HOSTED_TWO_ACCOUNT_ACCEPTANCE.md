# EYRA hosted two-account acceptance — staging only

This is an **explicitly opt-in integration test** for Supabase PostgREST/Auth using disposable staging identities. It is not part of default CI, does not deploy migrations, and is **hard-blocked** from targeting the live EYLO project `kbzjngpzxpniaumlupaa`.

## Preconditions

1. Have a separate, **active and expressly designated** staging Supabase project. The current connected projects include live `eyloai` and a separate inactive `job`; neither is automatically an approved EYRA staging target.
2. Reconcile and apply the reviewed EYRA migrations to staging **by an independently approved process**, not by this tool. Run the read-only `scripts/eyra-schema-readiness.sql` in staging and inspect with `scripts/check-eyra-schema-readiness.mjs`. A positive metadata verdict is still not an RLS proof.
3. Prepare **two different disposable, non-anonymous test accounts** with short-lived `authenticated` access JWTs obtained through **staging Supabase Auth**. This test does not create accounts or request passwords. Keep all access tokens private and out of chat, repository, issue comments and CI logs.
4. Use a staging **publishable** or legacy **anon** API key (not service role or secret key). Confirm the project reference from the exact canonical staging hostname.

## Run on your own authorized operator machine

Set the following environment values privately and invoke:

```bash
node scripts/eyra-hosted-ab.mjs
```

| Variable | Required value |
|---|---|
| `EYLO_STAGING_SUPABASE_URL` | Exact `https://<staging-ref>.supabase.co` (no path or custom domain) |
| `EYLO_STAGING_PROJECT_REF` | Same staging reference, and never `kbzjngpzxpniaumlupaa` |
| `EYLO_STAGING_PUBLISHABLE_KEY` | Staging publishable or anon key |
| `EYLO_STAGING_ACCESS_JWT_A` | Fresh `authenticated` access token for disposable user A |
| `EYLO_STAGING_ACCESS_JWT_B` | Fresh `authenticated` access token for a distinct disposable user B |
| `EYLO_STAGING_AB_ACK` | Literal `DISPOSABLE_STAGING_ACCOUNTS_ONLY` |

Do not save these tokens in project files, shared shell history, PR descriptions, screen recordings or logs. Use a local secret manager or private ephemeral shell session, then clear the variables.

## What the runner verifies

- A and B authenticate independently via hosted `GET /auth/v1/user`; local JWT decoding is used only to reject obviously unsafe input, never to authorize a user.
- Required PostgREST tables and grants are accessible as each user; the exact idempotent `save_eyra_conversation_snapshot` RPC persists one disposable snapshot per owner.
- Retrying A's exact UUID returns the same thread and one message.
- B cannot read, modify or delete A's thread or messages. A cannot read B's records. B cannot insert a forged A-owned message or reuse A's snapshot UUID.
- A can rename with the correct optimistic version, but a stale version cannot overwrite it.
- Owner deletion cascades messages. The test attempts best-effort cleanup of **only its two randomly generated UUIDs**, using the corresponding account JWT. An uncertain cleanup fails the run rather than claiming success.

Only a minimal, sanitized verdict is printed; no token, user ID, full provider error body or personal content is logged. A success means **hosted two-user staging acceptance only** and deliberately returns `production_release_approved: false`. It does **not** prove live SMTP delivery, OpenAI quota/billing, all product flows, or a safe production migration/rollback.

## Safety

Do **not** run this against production, an unapproved project or any real user's account. If you cannot confirm a staging project and disposable users, the correct state is **blocked** and the test must not run. Report the independent result in issue #309 before a separate human production decision.

