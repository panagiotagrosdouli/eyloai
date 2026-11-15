# EYRA action permission matrix

| Data/action | Required identity | Scope check | Plan check | User intent / confirmation | Status |
|---|---|---|---|---|---|
| List projects | Validated Supabase access token | Explicit user ID predicate and database RLS | Existing EYRA monthly allowance | User asks about their projects | Implemented in the Command Center tool path |
| Create project | Validated Supabase access token | Owner ID comes from authenticated identity; database RLS | Free single-project cap when billing configuration and free entitlement are active; existing EYRA allowance | Latest user turn must clearly request creation AND the request must carry separate user write confirmation; advice/draft requests are rejected | Implemented in the Command Center tool path |
| List Library papers | Validated Supabase access token | Explicit user ID predicate and database RLS | Existing EYRA monthly allowance | User asks about saved papers | Implemented in the Command Center tool path |
| Save a paper | Validated Supabase access token | Owner ID from authenticated identity; same-user DOI duplicate check and database RLS | Existing EYRA monthly allowance | Latest user turn must explicitly request saving AND carry separate user write confirmation; DOI title must match Crossref metadata | Implemented for Crossref-verifiable DOI records |
| Read another user's project | N/A | Not exposed; RLS and owner filter must deny | N/A | N/A | Must remain denied; live two-user test not run |
| Update/archive/delete project | N/A | Not exposed | N/A | Future policy must require explicit confirmation for destructive changes | Not implemented |
| Save/link non-DOI Library records | N/A | Not exposed | N/A | Verification policy required | Not implemented |

Server-side tool allowlisting and user-scoped Supabase requests are the enforcement points. The model does not receive service-role credentials. Existing project UI enforcement is not treated as authorization for API tool calls.

## Explicit review/confirmation flow (draft PR #457)

The Command Center uses a shared English/Greek latest-turn write intent detector. Before sending a recognized create-project or save-paper request, it renders a user-request review with **Edit**, **Cancel**, and **Confirm and send** controls. Unconfirmed write requests return a failed tool action and do not touch the workspace. Server validation uses the separate `latest_user_request` matched to the Command Center's latest-turn field plus `write_confirmed: true`; historical turns and the model cannot supply this permission. Read tools remain unaffected.

**Limit:** this is a review of the user's requested operation, **not** a transaction-level preview of every field the model will choose. The exact pending payload, durable idempotency ledger, and final confirmation before applying model-generated fields remain work tracked in #462. An authenticated API client may submit `write_confirmed: true` itself, so this flag is an explicit consent signal and not a cryptographic proof of an on-screen click.
