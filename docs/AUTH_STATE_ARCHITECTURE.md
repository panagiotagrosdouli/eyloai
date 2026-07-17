# Authentication state architecture

EYLO AI uses an explicit authentication state model rather than independent booleans.

## States

- `loading`: the initial session is being resolved.
- `authenticated`: a valid Supabase session and user are present.
- `anonymous`: no authenticated session exists.
- `configuration-error`: required Supabase environment configuration is unavailable or invalid.
- `error`: authentication failed for a non-configuration reason.

## Provider API

The authentication provider exposes:

- `user`
- `session`
- `status`
- `signIn`
- `signUp`
- `signInWithGoogle`
- `signOut`
- `refreshSession`
- `resetPassword`
- `updatePassword`

All Supabase authentication operations pass through `src/lib/supabase/auth.js` and return a consistent service result:

```ts
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
```

User-facing messages are produced by `src/lib/supabase/errors.js`. Raw Supabase error messages are not rendered directly in authentication forms.

Temporary aliases remain in `AuthContext` for legacy page compatibility. They are explicitly marked and should be removed after all consumers move to the new API.
