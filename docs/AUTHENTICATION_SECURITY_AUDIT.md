# Authentication and security audit

## Current repair findings

| Severity | Affected file | Observed behavior | Risk | Implemented repair | Validation result |
| --- | --- | --- | --- | --- | --- |
| High | `src/pages/Login.jsx` | Login return destinations were previously derived from query input and Supabase was called directly from the page. | Open redirect and inconsistent error handling. | Added strict internal redirect validation and routed login/OAuth through the auth provider service. | External, protocol-relative, malformed, backslash-based, and unknown destinations fall back to `/`. |
| High | `src/lib/AuthContext.jsx` | Independent booleans could represent contradictory states and duplicated session checks. | Auth race conditions, protected-content flashes, and ambiguous failures. | Replaced the internal model with explicit `loading`, `authenticated`, `anonymous`, `configuration-error`, and `error` states. | Initial session and auth listener now resolve to one state object. |
| Medium | Auth pages | Raw Supabase errors could be exposed or mapped inconsistently. | Information leakage and confusing user experience. | Added central error mapping in `src/lib/supabase/errors.js`. | Login now renders only mapped safe messages. |
| Medium | Supabase auth usage | Authentication calls were made from arbitrary presentation components. | Duplicated behavior and difficult security review. | Added `src/lib/supabase/auth.js` with consistent service results. | Password and Google login now use the service layer. |
| Medium | Startup configuration | Missing environment variables previously produced an ambiguous application state. | Broken authentication without actionable diagnosis. | Added startup environment validation and dedicated configuration experiences. | Only variable names are shown; values are never rendered. |

## Remaining work

- Move registration, password recovery, password update, and callback session handling fully onto the auth service API.
- Remove temporary compatibility aliases after all legacy consumers migrate.
- Add unit and component tests for state transitions and error mapping.
- Validate OAuth and recovery flows against a configured Supabase project.
- Add database migrations, RLS policies, and cross-user access tests.
