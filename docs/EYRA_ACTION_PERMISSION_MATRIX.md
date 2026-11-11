# EYRA action permission matrix

| Data/action | Required identity | Scope check | Plan check | User intent / confirmation | Status |
|---|---|---|---|---|---|
| List projects | Validated Supabase access token | Explicit user ID predicate and database RLS | Existing EYRA monthly allowance | User asks about their projects | Implemented in the Command Center tool path |
| Create project | Validated Supabase access token | Owner ID comes from authenticated identity; database RLS | Free single-project cap when billing configuration and free entitlement are active; existing EYRA allowance | Prompt must clearly request project creation; advice/draft requests are rejected | Implemented in the Command Center tool path |
| List Library papers | Validated Supabase access token | Explicit user ID predicate and database RLS | Existing EYRA monthly allowance | User asks about saved papers | Implemented in the Command Center tool path |
| Save a paper | Validated Supabase access token | Owner ID from authenticated identity; same-user DOI duplicate check and database RLS | Existing EYRA monthly allowance | Explicit save request; DOI title must match Crossref metadata | Implemented for Crossref-verifiable DOI records |
| Read another user's project | N/A | Not exposed; RLS and owner filter must deny | N/A | N/A | Must remain denied; live two-user test not run |
| Update/archive/delete project | N/A | Not exposed | N/A | Future policy must require explicit confirmation for destructive changes | Not implemented |
| Save/link non-DOI Library records | N/A | Not exposed | N/A | Verification policy required | Not implemented |

Server-side tool allowlisting and user-scoped Supabase requests are the enforcement points. The model does not receive service-role credentials. Existing project UI enforcement is not treated as authorization for API tool calls.
