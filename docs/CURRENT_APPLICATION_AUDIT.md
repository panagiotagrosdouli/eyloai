# Current application audit

_Last reviewed: 2026-09-25. Follow-up: 2026-11-07._

EYLO is a React/Vite research workspace with public scholarly discovery and an authenticated Supabase-backed workspace.

## Confirmed architecture

- React 18 + Vite single-page application with React Router.
- Public discovery across OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar.
- Supabase authentication, PostgreSQL persistence and row-level security.
- Vercel serverless functions for EYRA, funding, billing, monitoring and institution analytics.
- Stripe Checkout/webhook entitlement foundations.
- Supabase migrations for core entities, billing, operational services, analytics boundaries, security hardening and scheduled monitoring.
- GitHub Actions for production build, lint, auth/service smoke checks, retrieval resilience and deterministic relevance benchmarking.
- Core Node regression tests for discovery ranking and auth redirect/error behavior.

## Product surface

The workspace now separates the primary research journey from experimental decision-support surfaces.

### Core

- Home and guided research search
- Library
- Projects and project detail
- Researchers
- Funding/opportunities
- Evidence-aware EYRA
- Ideas, meetings and retained deliverables
- Search/activity history

### Labs

Experimental scenario, impact, research-landscape, team, professional-path and voice workflows live under `/labs/*`. Legacy route URLs redirect to their Labs equivalents so existing bookmarks continue to work.

## Implemented hardening

- Strict internal auth redirect validation.
- Centralized auth service and product-safe auth error mapping.
- Supabase RLS ownership policies and privileged server-only tables.
- Partial-source retrieval resilience and metadata-noise filtering.
- Lazy-loaded route surfaces.
- CI typecheck and regression-test gates.
- Dependabot configuration for npm and GitHub Actions.
- Security reporting, privacy/data-flow and discovery-evaluation documentation.

## Remaining production work

- Keep the committed npm lockfile current and review automated dependency updates before merge.
- Add browser-level end-to-end coverage for the critical account → discovery → save → project → EYRA → billing journey.
- Expand type checking until `src/lib`, API functions and remaining JavaScript surfaces are covered without exclusions.
- Build and publish a human-judged discovery relevance dataset and report Precision@k/nDCG metrics by domain and intent.
- Add server-side caching/rate-control for scholarly providers where operational evidence justifies it.
- Complete live cross-user RLS verification and production OAuth/recovery tests.
- Complete jurisdiction-specific privacy/terms/legal review before representing the engineering data-flow document as a legal policy.

## Follow-up review — 2026-11-07

A targeted source review of `src/lib/config/env.js` found that it still supplied hard-coded `VITE_SUPABASE_URL` and publishable-key fallbacks when environment configuration was absent. This contradicted the launch-gate requirement that a missing configuration must not silently select a project. The source and release-gate document were inspected at main commit `32f4546f02698a2838c339cdd351470421dc29c8`.

PR #217 removes those fallbacks and adds deterministic missing/valid/invalid configuration regression tests. Its latest observed GitHub Actions checks passed (build, build-and-benchmark, imports and verify) on commit `ebf6c47ec3a4cd83e7d820781de8378a3fbfec30`. The PR remains draft; Vercel preview was blocked by the account deployment rate limit.

This review did not verify deployed Supabase project identity, production environment variables, live RLS policies or two-account isolation. No database or deployment was changed. Those release gates remain unverified. The current overall release decision remains **NO-GO** until the launch-readiness gate records evidence for all required production checks.
