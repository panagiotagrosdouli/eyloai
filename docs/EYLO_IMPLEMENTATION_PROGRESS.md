# EYLO Implementation Progress — 2026-11-11

**Repository:** `panagiotagrosdouli/eyloai`  
**Candidate:** `integration/eyra-release-candidate-20261111` · PR [#331](https://github.com/panagiotagrosdouli/eyloai/pull/331)  
**Status:** Integrated code is in a **draft pull request**. Not merged, released, deployed or certified production-ready.

This ledger distinguishes source-reviewed, code-committed, CI-verified and **live** verified functionality. "CI passed" is only reported with the exact tested commit. Unfinished workflows must not be counted as successes.

## Implemented / source-backed engineering changes

| Domain | Implementation and integration evidence | Current evidence boundary |
|---|---|---|
| EYRA structured responses | `api/eyra.js`, `src/lib/eyra-structured-contract.mjs`, API and contract tests | JSON structure validation and quota rollback tested using deterministic model/usage mocks; no live model certification |
| EYRA reference integrity | `src/lib/eyra-citation-ids.mjs`, `src/components/eyra/EyraCommandCenter.jsx` | Bracketed citation IDs must resolve to retrieved records; unsafe provider URLs rejected; does not establish claim entailment |
| EYRA lifecycle | `EyraCommandCenter.jsx`, `tests/eyra-stop-generation-ui.test.mjs`, `tests/eyra-cancellation.test.mjs` | Stop aborts model, scholarly and funding client requests; late responses suppressed; external provider stop propagation and usage refunds need live verification |
| EYRA edit and resend | `EyraCommandCenter.jsx` | Previous user message is restored to editable input; only explicit Send invokes AI |
| EYRA privacy | `EyraCommandCenter.jsx`, `tests/eyra-personalization-boundary.test.mjs` | Opt-out prevents profile fetch, context cleared and late profile response ignored; browser privacy acceptance still pending |
| EYRA availability | `api/capabilities.js`, `src/components/system/ServiceStatus.jsx` | Configuration flag is not live provider health; UI says Configured, not Live |
| Authentication and private data | `src/lib/AuthContext.jsx`, `src/components/layout/AppLayout.jsx`, `src/lib/auth/privateSessionBoundary.js` | Logout/deep-link/cache clear tests use disposable browser/API doubles; real 2-account isolation not verified |
| Supabase tenant | `src/lib/config/env.js`, `api/supabase-config.mjs` | Production origin is pinned to intended project while disposable previews may use separate fixtures |
| Public transport | `vercel.json`, `src/lib/api-cors.mjs`, security CI workflow | TLS, anonymous API probes and dependency scans exercise the currently deployed site; proposed new headers are not yet production deployed |
| Scholarly source safety | `api/discovery.js`, `src/lib/scholarly-provider-backoff.mjs` | HTML challenge responses rejected; at most one Retry-After bounded provider retry |
| Research Gap Finder | `src/pages/ResearchGaps.jsx`, `src/lib/research-gap-context.mjs` | Changing project/evidence aborts stale model calls; gap and comparison results are displayed only for their own matching evidence context |
| Feature inventory | `docs/EYLO_COMPLETE_FEATURE_INVENTORY.md`, `docs/EYLO_FEATURE_VERIFICATION_REPORT.md` imported from PR #322 | Registry is a first-pass source inventory, explicitly not exhaustive user-action coverage or VERIFIED COMPLETE |

## Verified evidence

- Integrated previous head `b791166131d9305818f6259e5a1aab4da3fcf5e2`: **four GitHub Actions workflows succeeded**. Product Quality log: **326 tests passed**, zero failures; mock-based browser auth/private research journeys succeeded.
- On that head, read-only security checks observed TLS 1.3 with validated certificate, HTTP→HTTPS 308, npm audit zero reported vulnerabilities, anonymous `/api/eyra` and `/api/monitor` 401, untrusted preflight 403.
- The latest branch contains additional source-discovery, research-gap and EYRA cancellation/privacy changes. **Do not carry the prior 326-test outcome forward to the new head until its own workflows finish**.
- Independent PRs #317, #321, #322 passed their earlier CI, but combined coverage still requires integrated tests.

## External blockers — P0, not safely bypassable

1. Authorized Vercel project for `eyloai.vercel.app` is **not linked** to the connected Vercel account. Its build status reports an external rate limit. No paid upgrade is authorized.
2. Connected Supabase access points to a **different** project than intended EYLO production project `kbzjngpzxpniaumlupaa`. No access to that project's applied policies, auth settings, installed RPCs or storage; no database operations were attempted on the unrelated project.
3. Public production `/api/billing` and `/api/opportunities` previously returned 503 with missing Supabase configuration. Confirm current response before releasing.
4. Real registration, sign-in/out, recovery/OAuth, session transition, two-account RLS isolation and controlled project save require **authorized disposable accounts** in the correct environment.
5. Real authenticated OpenAI response, quota reservation/release and source-grounding acceptance require approved model configuration and a tiny authorized live run; none was executed.
6. Independent scientific benchmarking must assess unsupported conclusions, fabricated identifiers, citation entailment, abstract-only claims and contradictory studies. Deterministic syntactic checks alone are insufficient.
7. Full strict CSP, account deletion workflow, institutional memberships, Stripe billing/entitlements and LiveKit media require their own staged verification and explicit operational approval.

## Remaining functional work by priority

- **P0:** Resolve correct project access, confirm deployed SHA/config, test two-account RLS and real small EYRA workflow, staged security header compatibility, fix real provider/config failures.
- **P1:** Complete persistent literature review protocol and evidence tables, reproducible source snapshots, project-aware context with verified ownership, functional UI+API browser tests and consented research exports.
- **P2:** Scientific method/experiment design, human-reviewed evidence entailment evaluation, deterministic statistical routines.
- **P3+:** Campus permissions/collaboration, Learn, Venture, institutional scale after the identity and privacy foundations pass.

## Release gate

Do not mark any major module VERIFIED COMPLETE without exercised user actions, backend operation, persistence (if applicable), unauthorized access denial, failure cases, desktop/mobile and accessibility checks, source fidelity and reproducible test evidence. This candidate remains **NO-GO for production** until the explicit external blockers and release-owner approval are resolved.


## P1 addendum — literature review protocol

- PR #332 implements one real Project-linked protocol and screening workflow; no additional Supabase table or migration was created.
- Local field/authorization validation plus reproducible JSON snapshot tests; 310 unit/API tests and browser save/reload/export passed on PR #332 head `28ed431dc05064c5b677fbc10446d3a55f164338`.
- Source registry IDs: EYLO-REV-001 through EYLO-REV-004.
- The code has been copied into the integrated PR #331 branch; **the integrated current head requires its own CI check**.
- Production remains NO-GO until the intended Supabase project and real two-user authorization are verified; source metadata collection does not establish PRISMA compliance.
