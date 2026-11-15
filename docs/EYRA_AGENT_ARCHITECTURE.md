# EYRA agent architecture

## Implemented foundation

The authenticated `/api/eyra` endpoint remains the single OpenAI Responses API boundary. It authenticates the Supabase bearer token, reserves the existing monthly AI allowance, and optionally exposes project and Library tools to the Responses API. Database reads and writes use the same user bearer token and the configured public Supabase key, so Postgres RLS remains the authorization boundary. The server validates saved rows before reporting success. DOI paper saves also validate title metadata with Crossref.

The main Command Center enables this limited registry. Other EYRA entry points retain their current text and structured-output behavior. Project creation and paper saving are eligible only when the latest prompt explicitly asks for the action; asking for advice or a draft is insufficient. The request is executed in the same authenticated turn. No delete, archive, update, or cross-user operation is exposed.

## Current request flow

1. Validate method, bearer token, Supabase configuration, prompt and optional output schema.
2. Verify the bearer token with Supabase Auth and reserve the existing EYRA usage allowance.
3. Send the request to OpenAI. Add the project and Library tool definitions only when the Command Center explicitly opts in.
4. Validate each tool name and arguments, then call Supabase with the caller's bearer token. RLS scopes access to the authenticated user. DOI paper saves verify source metadata before writing.
5. Validate persisted project rows and pass the actual result or a safe error back to the model.
6. Return the completed answer and action result metadata. Upstream errors remain errors; tool calls are not treated as proof of success.

## Boundaries and remaining work

- The registry supports authenticated project and Library operations; this PR additionally adds `project.get`, read-only Notes/Tasks/Calendar summaries, and Crossref publication discovery / DOI metadata verification. These remain proposed branch capabilities until CI and integration tests pass.
- There is no durable action-history table yet; returned action metadata is request-scoped.
- The draft Command Center now has a separate user-request review with Edit/Cancel/Confirm and server-side `write_confirmed` validation for record-creating tools. This is *not* an exact field-level preview of model-generated writes; destructive actions remain unavailable.
- Non-DOI Library saves, project updates, milestones, deletion, exports, workflow persistence, cross-request idempotency keys, and broader route context are not implemented.
- Production OpenAI, Supabase RLS, billing entitlements, and deployment availability require live verification before claiming readiness.

## Incremental agent safeguards (PR #457)

- The stateless Responses agent now carries the complete prior tool exchanges into subsequent rounds, instead of only the latest round.
- Duplicate provider tool call identifiers cause a terminal 502 invalid-tool-sequence response inside a single request, without running the duplicate or sending an ambiguous follow-up. The response includes any previously confirmed actions to guide safe retries. This is **not** durable cross-request idempotency; a persistent action ledger is still required before advertising durable writes.
- Write permission is checked against the actual user prompt, not independently against the browser-supplied `tool_intent` field.
- A read-only `research.lookup_doi` tool validates bibliographic metadata from Crossref and labels it `bibliographic_metadata_only`. It never claims to have retrieved or interpreted full text.
- The initial TypeScript failure was corrected; full CI and live service acceptance must still pass before merge.

## Server-validated contextual workspace (review branch)

The Command Center accepts an optional resource identifier derived from the active `/projects/:id` route. The client forwards only `{kind:'project',id:UUID}`, not privileged project text. The authenticated backend retrieves `projects` under explicit owner predicate and RLS; `paper` and `note` resource types are additionally supported for explicit callers. Unsupported resource types or malformed UUIDs fail before quota reservation, and inaccessible resources return a not-found error without reaching the model. Only bounded, allowlisted scalar fields reach the model, labeled as untrusted user workspace data rather than independently verified scholarly evidence. A browser-provided resource ID never proves ownership.

The Command Center's prompt includes earlier conversation. Write authorization therefore extracts the latest user request from the structured prompt; historical instructions and earlier requests cannot authorize a new project creation or paper save. All enabled tool calls are verified against the model-exposed allowlisted tool contracts in deterministic backend code; unknown names, extra keys, wrong types, and oversized string values fail before dispatch.

## Latest-turn authorization and bounded context (draft branch)

The structured Command Center prompt includes old messages and retrieved data. The backend now requires a separate `latest_user_request` string matching the final structured turn, while direct API callers may send an ordinary unwrapped request. The shared English/Greek `requestedEyraWrites` classifier and `write_confirmed: true` jointly authorize creating a project or saving a paper. The UI's review step supports cancel or edit before consent; it does not preview exact model-produced arguments. A caller may supply `write_confirmed` directly, so this is explicit user consent metadata, not cryptographic click proof.

Project and Library *read* outputs use explicit field allowlists and length caps instead of dumping arbitrary stored JSONB data into the model. The contextual resource loader also enforces bearer + owner predicate + RLS and sends bounded records as untrusted user input, never privileged model instructions.
