# EYLO implementation checkpoint, 2026-11-16

Three independent fixes on main baseline `d8b18c987055660993046809761c253288bfca11`. This is a bounded implementation report, not completion of the full platform upgrade or production release approval. Existing open PRs and overlapping branches were reviewed before selecting the changes; the prior citation-export branch already matches main and was preserved.

| Change | Review branch / PR | Result |
| --- | --- | --- |
| Account-bound API retries and response bodies | [PR #484](https://github.com/panagiotagrosdouli/eyloai/pull/484), `fix/session-retry-account-boundary` | Cancels shared API, EYRA and billing requests on an account boundary; prevents replaying the previous account's body or signing out a newer token; retains cancellation during JSON/stream consumption; preserves Headers and the exact retry body. |
| Reliable bibliography exports | [PR #485](https://github.com/panagiotagrosdouli/eyloai/pull/485), `fix/bibliography-metadata-boundaries` | Validates citation-key years, escapes all BibTeX values, reuses DOI validation, separates semicolon-delimited authors, and excludes local/mapped-private IPv6 links without rejecting public IPv6 addresses merely containing `fc`. |
| Retained literature-review evidence | This PR, `fix/review-retained-evidence` | Restores saved screening sources outside recent100 through exact owner-checked reads; keeps unavailable sources and human decisions explicit; prevents incomplete saves/exports until the user resolves those entries. No automatic screening decisions or source metadata are invented. |

Each branch is independently based on the baseline above. The combined merge candidate still requires integration checks and owner approval. No PR was merged, no production promotion was requested, and no hosted migration, live payment or model-provider request was performed. The repository's existing Git integrations can build previews automatically for these PRs.

## Exact changed files

PR #484:

- `.github/workflows/quality.yml`
- `package.json`
- `src/lib/auth/sessionRequest.mjs`
- `src/lib/billing.js`
- `src/lib/eyra-intelligence.js`
- `src/lib/protected-api.js`
- `src/lib/supabaseClient.js`
- `tests/e2e-session-boundary.mjs`
- `tests/protected-api-account-boundary.test.mjs`

PR #485:

- `src/utils/citation-export.js`
- `tests/citation-export.test.mjs`
- `tests/e2e-auth.mjs`

Retained review evidence:

- `src/lib/literature-review-sources.mjs`
- `src/pages/LiteratureReview.jsx`
- `tests/literature-review-sources.test.mjs`
- `tests/e2e-learning-integration.mjs`
- `docs/release/EYLO_IMPLEMENTATION_2026-11-16.md` (this report)

## Executed verification

| Check | Observed result |
| --- | --- |
| `npm run check:imports`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` via `npm run check` | Passed on each implementation: 920 tests on the auth branch, 911 on bibliography, 916 on retained review evidence. Counts differ because branches are independent, not cumulative. Both TypeScript projects and the production chunk budget passed. |
| Targeted auth regressions | 14 passed: late 200/401, account switching during refresh, sign-out/re-sign-in, same-owner refresh, request/body cancellation, listener cleanup and failure recovery. |
| `npm run test:e2e:session` | Passed at 1440px and 390px using the actual Supabase browser client and synthetic HTTP. Exercises the shared API, EYRA and Checkout callers, cancellation, guarded invalidation and same-owner refresh. Added to Product quality CI. |
| `npm run test:e2e:auth` | Passed on auth and bibliography branches. The bibliography branch adds actual Library download assertions for BibTeX/RIS identifiers, authors, escaped fields and absence of internal record IDs. Existing suite also exercises registration/route guards, private CSV analysis, Notes/Files/Projects/Library workflows, recovery and mobile rendering. |
| `npm run test:e2e:learning` | Passed on auth and retained-review branches. New review scenario checks retained sources beyond recent100 at 1440px/390px, persistence, exact JSON metadata and explicit unavailable-source removal. Existing timer, quiz/course, conversation persistence, review conflicts, research records, budget, thesis and account-switch fixtures also passed. |
| `npm run test:e2e:discovery-gateway` | Passed on the auth branch: gateway 503, partial provider results and 429 remain distinguishable; no direct-provider bypass or raw private error text. |
| `python3 scripts/integration/test-local-postgres.py` | Passed in a disposable local PostgreSQL container: actual policies, ownership isolation, concurrency, quota, private conversations, files/storage metadata and workspace operations. |
| `EYLO_SQL_LEGACY_SCHEMA=1 python3 scripts/integration/test-local-postgres.py` | Passed: existing legacy rows, triggers and canonical policies exercised locally. No remote database was targeted. |
| `npm run benchmark:relevance` | Five synthetic ranking cases and DOI regression passed. These are engineering regressions, not human relevance or scientific-accuracy measurements. |
| `git diff --check` | Passed. |

Browser screenshots of retained and unavailable review sources were captured and visually inspected from synthetic fixtures. Browser transport fixtures do not prove hosted Auth, PostgREST, Storage bytes, external-provider availability or two-real-account isolation.

At the reporting checkpoint, exact-head [Build](https://github.com/panagiotagrosdouli/eyloai/actions/runs/43846948034), [EYLO Quality Gate](https://github.com/panagiotagrosdouli/eyloai/actions/runs/43846948062) and [Product quality](https://github.com/panagiotagrosdouli/eyloai/actions/runs/43846947964) all passed on PR #484 head `f77a53da15a7b66dec82ec65e1c990a55fbc56f2`. PR #485 Build and Quality Gate passed; Product quality was still running. Always inspect current checks on each PR; this historical observation does not certify later revisions. Supabase preview checks were skipped because automatic preview database creation is disabled.

## Security and scientific status

The fixes improve client identity boundaries, bibliography integrity and reproducible source retention. They do not modify backend RLS, grants, schemas, model prompts, entitlements or payment processing. Local PostgreSQL checks use separate simulated authenticated identities; real hosted two-user tests remain outstanding.

Existing discovery and EYRA evaluation infrastructure was inspected and retained. No independently reviewed judgments were supplied, so no Precision@5, Precision@10, nDCG@10, live duplicate rate, identifier correctness, claim-support score, provider reliability or retrieval-latency result is claimed. Existing source-ID/unit checks and synthetic rankings cannot establish scientific correctness. Expert source/claim review remains a human gate.

Read-only production observation during this run: `https://eyloai.vercel.app` and `/api/capabilities` both returned HTTP 200. Capabilities reported AI configured, billing disabled, contact disabled, scheduled monitoring disabled and institution analytics disabled. Configuration flags and reachable HTML do not establish successful authenticated service calls; the older audit's 404 observation must not be treated as the current availability result.

## Blocked and remaining work

- No owner-confirmed staging target, disposable staging accounts or provider credentials were available in this environment. Hosted sign-up/login/recovery, two-user RLS/Storage, deployed schema, live EYRA, Stripe test-mode checkout/webhooks and full external-provider acceptance were not executed.
- The full requested redesign, every route/tool audit and every integrated research journey are not completed by these three PRs. Existing navigation/workspace/EYRA/research PRs remain separate review work; this run does not supersede them or certify their behavior.
- Human scholarly judgments, claim-to-source review, manual keyboard/screen-reader/contrast assessment, pilot results, operational monitoring and backup/restore evidence remain outstanding.
- Verify exact-head CI and protected staging/browser behavior, then review the combined candidate before any merge or production promotion. Preserve current deployment protection and production data.

Deployment readiness: **not approved**. The changes are implemented and locally verified for review; full production readiness, formal accessibility compliance and scientific validation are not established.
