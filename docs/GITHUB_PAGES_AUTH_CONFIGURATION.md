# EYLO GitHub Pages authentication setup

The public site is https://panagiotagrosdouli.github.io/eyloai/ and its app is https://panagiotagrosdouli.github.io/eyloai/discover.

## Required Supabase dashboard settings

In the Supabase project configured by the existing `VITE_SUPABASE_URL`, open **Authentication → URL Configuration**.

- **Site URL**: `https://panagiotagrosdouli.github.io/eyloai/`
- **Additional Redirect URL**: `https://panagiotagrosdouli.github.io/eyloai/auth/callback`
- **Additional Redirect URL for password resets**: `https://panagiotagrosdouli.github.io/eyloai/reset-password`
- If the email template has custom markup, ensure it uses `{{ .ConfirmationURL }}` or the correct `{{ .RedirectTo }}`, not a hard-coded `http://localhost:3000`.

These Supabase settings are server-side and **cannot be corrected by a GitHub Pages deployment alone**. If the redirect destination is not allow-listed, Supabase can silently fall back to its Site URL.

The GitHub Pages workflow uses the existing public URL and publishable browser key from `.env.production`. Never put a secret/service-role key or a session token in the browser bundle or GitHub repository. In production, validate configuration before deploying; configuration values are not printed.

## Validate manually after changing URL Configuration

1. Revoke any previously exposed sessions and refresh tokens using trusted Supabase account administration. Do not share confirmation URLs or fragment access tokens.
2. Open `/eyloai/register` in a private browser window and create a **test** account.
3. Follow a newly generated confirmation email link. The destination must be `https://panagiotagrosdouli.github.io/eyloai/auth/callback`, not localhost.
4. Verify the account session succeeds and that login, logout, password reset and authenticated library access work.
5. Verify that `/eyloai/discover` and `/eyloai/find-researchers` work without signing in.
6. Confirm protected records remain user-scoped under RLS. Do not disable email confirmation, RLS or authorization checks to work around an error.

## Real-world meeting requests

`/find-researchers` fetches public scholarly profiles and prepares an editable inquiry. A meeting is **not** booked until the researcher accepts an invitation. There is currently no verified professor-calendar or email-sending integration in this public flow.
