# EYLO + EYRA production readiness — evidence audit (2026-11-20)

This document distinguishes a deployed build from independently validated end-to-end product behavior. It is an audit snapshot, **not** a release certification.

## Verified baseline

- GitHub main commit at audit: `eed79658561e8d7fc609d6eb10f60b619db46c2e` (merged PR #570).
- Vercel canonical alias `eyloai.vercel.app` targets production deployment `dpl_9KJwqBxtgdtf5dZx22Ct9gxdcj7G`, status `READY`, at the same main SHA.
- Main branch Build, Product quality and GitHub Pages deploy completed successfully for that commit.
- Browser test suites use isolated HTTP fixtures where indicated. Passing them **does not establish** live Supabase RLS, AI provider billing, or production model generation.
- A real authenticated user reported a greeting receiving the `EYRA_INCOMPLETE` evidence-only fallback. The old production runtime showed a POST to `/api/eyra`, but no conclusive provider failure reason. No successful authenticated OpenAI completion has been established in this audit.

## Evidence-based release matrix

| Area | What is verified | Outstanding production proof | Priority |
| --- | --- | --- | --- |
| Public scholarly discovery | Implemented OpenAlex/arXiv/Europe PMC/Crossref/Semantic Scholar adapters and fixture/browser checks | Provider availability, latency, relevance, deduplication and citation accuracy on a dated, human-reviewed query set | P1 |
| Researcher/institution search | Public OpenAlex discovery adapters and tests | Human checking of profile identity, affiliation freshness and provenance | P2 |
| EYRA chat/streaming | Safe incomplete-stream rejection, fallback and automated tests | One authorized, successful provider-backed streamed answer, token/cost and precise failure classification | **P0 for AI launch** |
| EYRA citation integrity | Source ID validation and source-aware prompt bounds in code/tests | Blind expert evaluation: every cited claim traceable to originals and metadata/full-text separated | P1 |
| EYRA saved conversations | Synthetic browser regression for Save/Clear/Restore/Export and owner checks | Approved live staging two-user RLS, persistence, account switching and transaction retry tests | P1 |
| Workspace projects/library | UI and synthetic owner-isolation/exports tests; Supabase RLS integration in CI | Production test account save/reload/export and negative cross-user access; no real user data used | P1 |
| Funding | Official Grants.gov adapters; source disclaimers | Eligibility/deadline checked against live official record with authenticated account | P2 |
| PhD/EURAXESS | Transparent upstream outage and direct-source fallback | Official permitted provider integration (upstream 403 blocks ingestion; issue #506) | P1 |
| Billing/usage | Server usage controls and machine-readable quota errors in code | Administrator check of OpenAI project balance/model access, provider 429 classification; Stripe live verification | P1 |
| Security/privacy | Auth boundary, quotas, ownership and safe logging tests; no raw upstream payloads in failure copy | Approved staging penetration checks, session logout/cross-account replay and production telemetry review | P1 |
| Accessibility/performance | Browser workflow checks and bundle budget checks | Representative devices, keyboard/screen reader review, latency and error budgets | P2 |

## Release blocking findings

1. **EYRA incomplete answer:** issue [#507](https://github.com/panagiotagrosdouli/eyloai/issues/507). No verified live provider success. Distinguish `OPENAI_QUOTA_EXHAUSTED`, `OPENAI_RATE_LIMITED`, stream timeout, incomplete model generation and malformed SSE. Avoid blind retries, repeated writes or publishing partial scientific answers.
2. **EURAXESS upstream restriction:** issue [#506](https://github.com/panagiotagrosdouli/eyloai/issues/506). Obtain provider permission/feed; no bypass or fabricated PhD records.
3. **Broad EYRA acceptance gap:** tracker [#462](https://github.com/panagiotagrosdouli/eyloai/issues/462). Complete staged RLS checks, live source-to-claim evaluation and durable action verification; historical notes in that issue are not proof of current production schema.
4. **Misleading fallback when no sources were requested:** fixed in the accompanying PR by replacing a source-record heading with an explicit AI-outage state. The AI stream failure itself is **not** claimed fixed.

## Safe go/no-go process

1. Run `npm run check` and full Product quality, including browser fixture regressions. Verify that the tested PR head is the one merged and deployed.
2. With authorized staging identities, verify two-account data isolation and Save → Clear → Restore → Export on live RLS. Never share auth tokens, prompts or private records in issue logs.
3. An administrator reviews API project quota/billing and model access privately. Make one low-cost, explicitly authorized EYRA test request, record only HTTP status, safe error code, duration and successful completion marker. If missing, mark **AI feature unavailable**, not **production verified**.
4. Evaluate a fixed set of research questions with source-level grading for factual correctness, unsupported claims, citation precision, and explicit uncertainty. Include adversarial/absent-source cases.
5. Test external adapters against official records and report partial outages rather than false no-results.
6. Deploy only an approved, fully passing SHA; verify Vercel alias exactly matches it and monitor post-deploy errors. A clean log window without traffic is not success evidence.

## Decision on 2026-11-20

**EYLO web platform:** deployable build with green CI and a READY Vercel production release.

**EYRA as a dependable live AI research assistant:** **not yet verified**, because an observed real-world failure has no successful provider-backed completion. Treat live research synthesis as beta/unverified until #507 acceptance is demonstrated.

**EURAXESS PhD ingestion:** degraded, with direct-source fallback; not an operating in-app integration.

No credentials, billing, production schemas or user data were changed for this audit.
