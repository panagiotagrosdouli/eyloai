# EYLO — premium release readiness

## Verified engineering changes

- **Pages frontend:** Build the Vite/React app using `EYLO_GITHUB_PAGES=true`, publish `dist/` with GitHub Actions, apply `/eyloai/` base URLs and a React Router basename. Publish a static `404.html` SPA fallback.
- **Traceability:** Stamp `release.json.git_commit`; verify the public Pages manifest resolves to the exact deployed SHA. A successful Jekyll build alone does not pass this gate.
- **Design:** Editorial EYLO landing, topic-neutral public discovery, linked Library/Projects surfaces and source-aware scientific language.
- **Backend:** GitHub Pages serves static files only. It does not run `/api/*`, server-side AI, billing webhooks, or scheduled jobs. Those services must be deployed and tested on an independent secure backend before being marked available.
- **Account/data:** Verify the **actual Supabase project configured by `VITE_SUPABASE_URL`**, not any unrelated Supabase connection. Do not publish an unverified Supabase URL or privileged key. Login, profile and RLS remain unverified until the real project is accessible.

## Required repository / hosting settings

1. Set **Settings → Pages → Build and deployment → Source: GitHub Actions**. This cannot be enabled by a repository code commit alone.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon browser key only) to GitHub Actions secrets when the correct Supabase project is confirmed. Never use the Supabase service role/secret key as a Vite variable.
3. Ensure the actual backend is reachable over HTTPS. If its origin changes, configure a vetted backend URL in the client and validate CORS, request authentication and server authorization. Do **not** silently send privileged requests to an arbitrary public host.
4. Verify GitHub Actions deployment ends green and `https://panagiotagrosdouli.github.io/eyloai/release.json` contains the merged SHA.

## Release acceptance gates

| Gate | Evidence required |
| --- | --- |
| Frontend | Exact-release GitHub Pages check, app loads, static assets return 200, 404 fallback serves deep links |
| Navigation | Desktop and mobile flows for Discover, sign in, Library, Projects, workspace and logout |
| Research provenance | Source records open; paper metadata and AI interpretation are clearly distinguishable |
| Backend | Authenticated `/api` capability checks on a verified host; degraded services represented honestly |
| Data security | RLS cross-account tests, no privileged keys in bundle, owner-scoped saves/removals |
| EYRA | Citation grounding, failure-state behavior, scientific accuracy evaluation with human-reviewed examples |
| UX | Keyboard navigation, reduced motion, responsive layouts, loading, error and empty states |
| Commercial | Stripe test-mode checkout + webhook flows before paid access |
| Pilot | Recorded feedback and task-completion observations from real research users |

A green GitHub Actions build alone is **not** release acceptance. Do not mark any untested gate as complete.
