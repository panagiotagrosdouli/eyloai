# Current application audit

_Last reviewed: 2026-09-25._

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
- Explicit environment configuration handling.
- Supabase RLS ownership policies and privileged server-only tables.
- Partial-source retrieval resilience and metadata-noise filtering.
- Lazy-loaded route surfaces.
- CI typecheck and regression-test gates.
- Dependabot configuration for npm and GitHub Actions.
- Security reporting, privacy/data-flow and discovery-evaluation documentation.

## Remaining production work

- Commit a package-manager lockfile and switch CI/deploy installs to deterministic `npm ci`.
- Add browser-level end-to-end coverage for the critical account → discovery → save → project → EYRA → billing journey.
- Expand type checking until `src/lib`, API functions and remaining JavaScript surfaces are covered without exclusions.
- Build and publish a human-judged discovery relevance dataset and report Precision@k/nDCG metrics by domain and intent.
- Add server-side caching/rate-control for scholarly providers where operational evidence justifies it.
- Complete live cross-user RLS verification and production OAuth/recovery tests.
- Complete jurisdiction-specific privacy/terms/legal review before representing the engineering data-flow document as a legal policy.
