# EYLO public smoke test

Run against a reviewed Vercel preview or staged deployment:

```bash
node scripts/smoke-public.mjs https://your-preview.vercel.app
```

The script checks the landing page, static release manifest, robots policy, public/auth SPA routes, `/api/capabilities`, and `/api/deployment-status`. Both release sources must report a valid commit SHA, and the API must return JSON with verified provenance. Redirects are not followed, including authentication and deployment-protection redirects. HTTPS is required except for localhost. No credentials are needed or accepted in the URL. When `EYLO_EXPECTED_GIT_SHA` is set, both SHA values must match it; the manual production smoke workflow supplies its triggering commit automatically.

**A pass is not a launch approval.** Confirm the exact deployment commit on Vercel and complete all authentication, two-user Supabase RLS, evidence quality, billing, privacy, backup, monitoring and rollback checks in [LAUNCH_READINESS_GATE.md](./LAUNCH_READINESS_GATE.md). Never paste or commit secrets. A protected preview must be tested with an appropriately authorized browser or deployment mechanism; do not bypass protection in this script.
