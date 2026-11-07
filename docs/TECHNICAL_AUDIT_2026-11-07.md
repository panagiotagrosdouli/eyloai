# EYLO AI — technical audit register

**Review date:** 2026-11-07  
**Repository:** `panagiotagrosdouli/eyloai`  
**Latest reviewed main:** `b03f97568cfc0c428a5942f3be5b8a40fe39ec4c`  
**Review scope:** targeted desk audit of repository docs, selected frontend/config/API code, current PRs, GitHub Actions and public production smoke checks. This is not a full browser, database, billing or human research evaluation.

## Executive decision

**NO-GO for release today.** The public Vercel URL returned HTTP 404 on all eight production smoke checks at main commit `affcd76e50d750c33667623e1a540a6f9ca16a88`. The Vercel connection available during this review could not find the intended `eyloai` project or deployment. There is no verified way in the current session to repair the correct production project/domain mapping.

Build and automated quality checks passed for the selected security fixes. That does not establish production availability, Supabase RLS, scientific accuracy, billing readiness or pilot readiness.

## Priority issue register

| Priority | Finding / evidence | Status | Next verification or action |
| --- | --- | --- | --- |
| P0 | Production URL `https://eyloai.vercel.app` returned 404 for landing, manifest, robots, discovery, login, registration, password recovery and capabilities in the GitHub smoke workflow. The available Vercel connector had no `eyloai` project/deployment. | BLOCKED; exact Vercel failure cause unresolved. | Restore access to the intended Vercel team/project, verify its Git repo/root/build settings and domain mapping, deploy reviewed main, then rerun all smoke checks. |
| P0 | Hard-coded browser Supabase URL/key could silently select a database if configuration was missing (`src/lib/config/env.js`). | FIXED in PR #219; GitHub Actions build, imports and verification passed before merge. | Confirm production env variables belong to the intended project after correct Vercel access is restored. |
| P0 | `/api/capabilities` advertised Institution Analytics unconditionally, and its endpoint could call an unverified RPC. | FIXED in PR #206: capability defaults off and endpoint fails closed. CI passed. Analytics is still disabled. | Verify deployed migration, grants and two-account isolation before any authorized operator enables it. |
| P0 | Server-side analytics URL/key fallbacks could still route requests to the default project if the feature flag were enabled with missing config. | FIXED in PR #220; tests cover missing/invalid config and no-network behavior. CI passed. | Verify production env values and leave analytics disabled until live acceptance passes. |
| P0 | Production Supabase identity, RLS policies and cross-user read/write/delete isolation are not demonstrated by repository SQL. Existing operational checklist explicitly says live RLS is unverified. | NOT RUN. | Use the intended project and disposable accounts only; complete the documented two-user test and database security review. |
| P1 | Human-judged discovery relevance results do not exist. Main contains evaluation tooling, but no expert labels or report. The last documented 5-query run was only heuristic coverage (2/5 queries met minimum source coverage). | NOT RUN scientifically. | Freeze queries and snapshots, obtain independent human judgments, calculate P@5/nDCG@10 and report limitations. |
| P1 | Production smoke is not a browser-level test; no verified account → discovery → save → project → EYRA flow was observed during this audit. | NOT RUN. | Add/run browser E2E on the correct preview after Vercel is restored. |
| P1 | Discovery proxy documentation still identifies missing per-IP rate limiting/authenticated quotas. | OPEN risk. | Choose an operationally reliable shared limiter; validate abuse controls and provider terms. |
| P1 | Collaboration board PR #210 remains open and requires a migration plus two-account acceptance; it is not part of verified production. | OPEN PR; feature not released. | Apply only to verified staging, test ownership and moderation/privacy, then review before release. |
| P1 | Account deletion PR #209 is an owner-only request intake, not deletion; actual retention/deletion is unverified. | OPEN draft; deletion feature incomplete. | Implement and verify full deletion workflow before claiming account deletion support. |
| P2 | GitHub reports the `main` branch as unprotected. | CONFIRMED repository setting; no policy changed. | Configure branch protection and required CI/review after repository owner agreement. |

## Changes merged during this review

- PR #206: fail closed for unverified Institution Analytics.
- PR #219: remove browser-side Supabase fallback configuration.
- PR #220: remove server-side analytics Supabase fallbacks and require explicit valid config.

Each PR’s GitHub Actions build/import/verification checks passed. PR #220 additionally passed the repository’s combined test/benchmark workflow after its existing mock service test was updated to use explicit test-only Supabase values.

The main workflow also deployed commit `affcd76e50d750c33667623e1a540a6f9ca16a88` to GitHub Pages. That host is not the configured Vercel production URL and does not provide Vercel serverless functions, so it does not resolve the production outage.

## Verification report

| Check | Status | Evidence / limitation |
| --- | --- | --- |
| PR #206 automated checks | PASS | GitHub Actions build, build-and-benchmark, imports and verify. |
| PR #219 automated checks | PASS | GitHub Actions build, build-and-benchmark, imports and verify. |
| PR #220 automated checks | PASS | GitHub Actions build, build-and-benchmark, imports and verify. |
| Production public smoke | FAIL | 8/8 endpoints returned HTTP 404 on commit `affcd76e50d750c33667623e1a540a6f9ca16a88`. |
| Vercel production deployment for reviewed main | NOT VERIFIED | Correct project not available via current Vercel connection. |
| Supabase identity / live RLS / two-user isolation | NOT RUN | No verified production project access. |
| Human-judged scientific retrieval benchmark | NOT RUN | No genuine judgments. |
| OAuth, persistence, billing, deletion, mobile/accessibility | NOT RUN | Not tested in this review. |

No Supabase database, Stripe account, Vercel production settings or production secrets were changed. No live charges, migrations or production data tests were run.
