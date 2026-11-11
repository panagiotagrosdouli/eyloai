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

- The registry currently supports `project.list`, `project.create`, `library.list_papers`, and `library.save_paper` for DOI records verified by Crossref.
- There is no durable action-history table yet; returned action metadata is request-scoped.
- There is no independent confirmation UI. A clear user request to create a project is treated as authorization for this reversible action; destructive actions are not available.
- Non-DOI Library saves, project updates, milestones, deletion, exports, workflow persistence, idempotency keys and broader route context are not implemented.
- Production OpenAI, Supabase RLS, billing entitlements, and deployment availability require live verification before claiming readiness.
