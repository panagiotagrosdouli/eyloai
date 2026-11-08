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

A targeted P0 review on main found hard-coded Supabase fallbacks in both browser configuration and the server-side Institution Analytics endpoint. PR #219 removed browser fallbacks; PR #206 made Institution Analytics fail closed by default; PR #220 removed server-side Analytics fallbacks and added explicit configuration checks. All three changes passed their GitHub Actions build/test jobs before merge. Analytics remains disabled and was not tested against a live database.

The live public smoke workflow on main commit `affcd76e50d750c33667623e1a540a6f9ca16a88` returned HTTP 404 for all eight checks: landing HTML, release manifest, robots policy, discovery, login, registration, recovery and capabilities. The GitHub Pages deployment for that commit succeeded at the repository Pages URL, but that is not the configured Vercel production service and does not provide the Vercel serverless API. The available Vercel connection did not expose an `eyloai` project or deployment; project lookup for the production hostname returned not found. The exact reason for the Vercel 404 remains unresolved.

Production Supabase identity, deployed RLS, two-account data isolation, production OAuth/recovery, EYRA scientific accuracy, billing, deletion/export, mobile accessibility and human-judged retrieval quality remain unverified. Main was reported by GitHub as unprotected. See [TECHNICAL_AUDIT_2026-11-07.md](./TECHNICAL_AUDIT_2026-11-07.md) for the evidence-based issue register.

Current release decision: **NO-GO** for public production and researcher pilot while the production URL returns 404 and security/quality gates remain unverified.
