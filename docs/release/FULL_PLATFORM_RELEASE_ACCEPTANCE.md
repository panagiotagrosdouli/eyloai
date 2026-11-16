# Full EYLO 77-product launch acceptance gate

This extends the existing `research-workspace-v1` validator without changing its scope or weakening any of its security, research, scientific-quality, provider, billing or legal gates.

## Operation

Run `npm run release:full-readiness` from the exact candidate checkout. Optional arguments are the full-platform ledger, workspace ledger, and inventory matrix paths, in that order:

```sh
npm run release:full-readiness
npm run release:full-readiness -- docs/release/full-platform-readiness-evidence.json docs/release/market-readiness-evidence.json docs/integration/product-matrix.json
```

The command exits **1 / NO-GO** if any prerequisite or any product acceptance is missing, mismatched or stale. An exit 0 means **READY_FOR_OWNER_REVIEW** only, never authorization to deploy or charge customers.

## Prerequisites and strict checks

1. A current, exact-source-SHA `market-readiness-evidence.json` must pass the existing 14 foundational gates, including owner-confirmed isolated Supabase staging identity and matching Vercel preview.
2. The machine inventory must contain exactly the 77 canonical named products with unique IDs 1–77. Their implementation status must be `COMPLETE` based on independently accepted implementation evidence; a route rendering is not sufficient.
3. Every product must have a matching SHA, staging project, two distinct disposable user IDs, reviewed evidence reference within seven days, and all 12 product assertions: requirements, actual frontend, backend actions, persistence, authentication, two-user authorization, error recovery, E2E, cross-product integration, accessibility, staging acceptance and documentation.
4. A fresh, reviewed, read-only **staging database schema snapshot** must contain every unique `supabase_entities` table declared across the 77-product matrix plus `inventory.additional_entities`. Each required table must have `rls_enabled: true`. Separate assertions cover migration reconciliation and Storage policies; an RLS flag does not prove policy correctness.
5. The CLI reads current `src/App.jsx` and extracts explicit public/private paths. `site.tested_public_routes` and `site.tested_private_routes` must contain those exact paths, not just matching counts. If the ProtectedRoute boundary changes or the accepted route list is stale, the gate fails. Full-site acceptance also requires measured interactive-control counts and ten assertions for identity, persistence, pricing, error states and WCAG 2.2 AA review. This scanner covers the current `App.jsx` layout; reviewers must identify routes introduced elsewhere. The counts cannot remain null or zero.
6. Five mandatory journeys are separately accepted: research-to-deliverable, document round-trip, study-to-progress, opportunity-to-application and team-to-meeting.
7. An independently reviewed *additional-feature inventory* must be published in `inventory.additional_features` (a string array), with every discovered extra accepted. Empty array is acceptable **only after** the explicit source/route/backend/advertisement inventory review has passed.
8. Any partial or unaccepted item blocks the full platform. Only reviewed, sanitized GitHub run references and committed `docs/release/evidence/*` artifacts are structurally acceptable evidence links.

## Current status (2026-11-16)

The default ledger intentionally marks all 77 products and schema review `NOT_RUN`. The inherited matrix carries `Partially implemented` statuses and does not yet contain independently audited `additional_features`. No live two-account or provider acceptance, full public/mobile/keyboard control inventory, or legal/owner launch sign-off has been observed. The expected result is **NO-GO**.

Do not populate `PASS` from local fixtures, a green Build, a READY Vercel preview, a static screenshot, or historic test output. The validator checks compatibility and can never itself certify that a human-supplied report is truthful. Never enable production payments, merge unreviewed PRs, apply hosted migrations or promote production from this tool.
