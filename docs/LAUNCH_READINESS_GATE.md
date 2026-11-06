# EYLO — Launch readiness gate

This is a release **gate**, not a claim that EYLO is already production-ready. Keep all items unchecked until a reviewer has recorded evidence of a successful run in the intended production environment.

## Gate A — Quality and deployment

- [ ] Latest main-branch GitHub **Build** and **Product quality** runs pass.
- [ ] Production deployment serves the same reviewed commit and the home/search/library/project routes load on desktop and mobile.
- [ ] No production secret or Supabase service-role credential is bundled into the browser.

## Gate B — Live research (with real network responses)

- [ ] Test research queries in biomedical, computer-science, climate and social-science domains; inspect top-10 results against the linked primary source.
- [ ] Verify de-duplication by DOI and absence of metadata-only pseudo-papers.
- [ ] Simulate upstream timeout and HTTP 429; the UI reports partial retrieval and does not present an outage as “nothing exists”.
- [ ] Verify an EYRA claim links to a real retrieved source and clearly labels model inference.
- [ ] Verify funding results from official notices; deadlines, location and eligibility are not invented.

## Gate C — Two-user Supabase acceptance test

**Use a dedicated test environment or disposable test accounts** tied to the *actual production project's ID*. Do not connect to or change any unrelated Supabase project.

1. Register test account A and test account B; verify login, logout, password reset and session expiration.
2. Under A, create a project and save one paper. Link that paper to the project.
3. Refresh, sign out and sign in again as A. Verify both records and link persist.
4. Under B, check that A's paper/project do not appear.
5. Attempt to read, update and delete A's exact known record IDs while authenticated as B through the browser Data API. All attempts must be denied or return no row; A's records must remain unchanged.
6. Under A, unlink and delete the saved paper. Confirm project-link state and UI reflect the database result.
7. Repeat with saved researcher and funding opportunity, including an older linked record outside the first 100 global Library records.
8. Run Supabase database security advisors and inspect every exposed table's RLS policies.

- [ ] All steps completed and results captured, with no sensitive customer data in screenshots or logs.

## Gate D — Billing and entitlements

- [ ] Verify production Stripe credentials, signed webhook handling and customer mapping.
- [ ] Test checkout, successful renewal, cancellation, failed payment, billing portal and duplicate-checkout prevention.
- [ ] Verify backend limits for free, paid, revoked and expired entitlements.
- [ ] Ensure any incomplete payment integration is explicitly unavailable, not advertised as functional.

## Gate E — Legal, privacy and operations

- [ ] Publish jurisdiction-appropriate Terms, Privacy Notice, contact and deletion/retention policies after legal review.
- [ ] Verify privacy controls, backup and recovery procedure, monitoring, incident response, rate limits and owner contact.
- [ ] Obtain usability feedback from real external testers and act on critical blockers.

## Release decision

**NO-GO until A–E pass and the owners record evidence and sign-off.** CI green is necessary but cannot substitute for live cross-account RLS, research quality, payment and recovery verification.

The GitHub repository's Supabase URL, deployed environment variables and any connected Supabase workspace must be confirmed to refer to the same intended system before database testing or migrations.

## Latest evidence snapshot — 2026-10-31

- Production URL: [https://eyloai.vercel.app](https://eyloai.vercel.app)
- Reviewed production commit: `f6693282cef388c30d8ec72e21dc590ecc67b2c9` (PR #192); Vercel deployment `dpl_ByyjuQbj1FQX9jXbDxHJnzeetKR2` is `READY` and aliased to the production domain.
- PRs #191 and #192 passed Vercel status checks. Local `npm run check` passed with 115 tests, typecheck, lint, and production build.
- Production public smoke checks passed 8/8: landing HTML, release manifest, robots policy, discovery route, login route, registration route, password-recovery route, and server capability endpoint.
- Production capabilities: AI available, billing disabled, scheduled monitoring unavailable, institution analytics available. No live charges were enabled.
- The corrected live proxy benchmark received arXiv results; the previous Node benchmark had falsely marked arXiv unavailable because it depended on the browser-only `DOMParser`. Across 5 queries, 3–4 of 5 indexes responded. Europe PMC returned HTTP 503; Semantic Scholar returned HTTP 429 in 4/5 queries.
- Only 2/5 queries met the minimum source-coverage criteria. Their average heuristic anchor coverage was 0.65; one passed and one failed the heuristic gate. The remaining three queries had fewer than five results or insufficient source diversity. This benchmark is not a human-judged relevance study; keep the release decision NO-GO.


These checks do not prove cross-user Supabase RLS, authenticated persistence/deletion, EYRA scientific accuracy, complete DOI metadata fidelity, mobile coverage, or payment flows. Keep all launch-gate boxes unchecked until their own evidence is recorded.


## Discovery proxy response safety — draft change (2026-11-06)

The public `/api/discovery` handler currently fetches from an allowlist of
scholarly providers. The proposed change caps provider response bodies at
4 MiB **in the server-side stream reader**, independent of whether the
provider provides an honest `Content-Length`. Oversized results fail with an
uncached HTTP 502 and code `SOURCE_RESPONSE_TOO_LARGE`; they must not be
confused with an empty scientific search result. A header-only length check
is insufficient, so the reader also counts received bytes.

The proxy also forces a safe response media type (JSON for metadata providers,
Atom XML for arXiv) and `X-Content-Type-Options: nosniff`, avoiding direct
reflection of an upstream `text/html` response under EYLO's origin.

**Limits:** This does not implement per-IP rate limiting, authenticated
quotas for public discovery, or full provider content validation. Review
provider-specific payload sizes and false positives with a real network
benchmark before deploying. Verify that a provider error and an oversized
response are communicated as source failures, never zero evidence.


## Early-access AI usage safety gate — code proposal (2026-11-05)

A production EYRA deployment with Stripe billing disabled previously treated
all authenticated requests as unmetered early access. This can cause unbounded
model spend and is **not** a public-launch-ready cost-control policy.

An optional `EYRA_EARLY_ACCESS_MONTHLY_LIMIT` setting now enables the existing
server-side atomic `reserve_eyra_usage` RPC, even when Stripe is disabled.
Use a positive integer, for example `20`. No setting means no behavior change.
If the setting is configured but a server-only `SUPABASE_SECRET_KEY` is absent,
EYRA fails closed with HTTP 503 **before** making an OpenAI request. The public
capability endpoint advertises AI as unavailable in this case, not unlimited.
The frontend reads the same configured cap for its early-access status.

Operational requirements BEFORE enabling this flag:

1. Confirm the real production Supabase project ID and that the billing/usage
   migration is applied; inspect RPC grants, tables and security advisors.
2. Set the appropriate **server-only** `SUPABASE_SECRET_KEY` on Vercel. Never
   use `VITE_` for secret keys; never paste key values into chat or GitHub.
3. Run isolated test accounts through quota acceptance (first request), quota
   exhausted (429), upstream failure refund, restart, and next-month reset.
4. Set a conservative cap informed by a tracked AI budget. Add per-minute
   abuse controls and monitor total spend; monthly account caps alone do not
   prevent account farming or multi-account abuse.
5. Do not enable billing or perform live customer writes as part of the PR.

This is a deployment **preparation**, not verification of the currently
connected Supabase database. The available connector project does not match
EYLO production and must not be changed.


## Analytics SQL schema mismatch — 2026-11-05 follow-up

Source review found that the existing analytics SQL queried `public.profiles`
using columns (`id`, `organization`, `full_name`, `created_at`) that
conflict with the repository's base profile schema (`user_id`, `data`,
`created_date`). The historical SQL sources and their schema regression tests
were corrected in a draft PR. **These edits do not fix an already-applied
production migration.** See `docs/ANALYTICS_SCHEMA_REPAIR.md` for the verified
project identification, new migration and authenticated staging checks needed.
Analytics and overall release status remain unverified / NO-GO.


## Institution Analytics truthful availability gate — proposed release-candidate change

The `/api/capabilities` endpoint no longer reports `institution_analytics:
true` unconditionally. Both that capability and the authenticated
`/api/admin-analytics` backend now require the **explicit** server-side
`EYLO_ANALYTICS_ENABLED=1` setting. Default is disabled, including when
Supabase is connected but its deployed analytics RPC has not been inspected.
This setting is **not evidence of successful security review**; it is a
post-acceptance operator switch. Do not set it to `1` until the actual
production project, SQL schema, grants and signed-in account-isolation tests
have passed and release evidence is recorded.

The analytics endpoint also sets `Cache-Control: private, no-store` for
success and failure, refuses absent authentication, and validates the
shape of the RPC response before presenting per-user metrics. These
checks do not substitute for RLS, `SECURITY DEFINER` review or execution
with real test accounts. Do not enable analytics simply because CI passes.


## Evidence-review integrity and independent-human evaluation — 2026-11-06

The integrated candidate rejects incomplete, duplicate and conflicting
second-model reviewer results rather than publishing favorable fragments.
The offline independent-human evaluation runner compares model verdicts
and actually retained claims with independently adjudicated labels,
including per-domain 95% false-acceptance uncertainty bounds.
**No real human-labelled evaluation corpus or live-model study has been
run**. The existing synthetic 8/8 false-acceptance example remains a
known safety limitation; strict response completeness alone cannot solve
semantic entailment errors. See `docs/EYRA_HUMAN_EVALUATION.md`.
Release Gate B remains OPEN / NO-GO until actual external review.


## Blind human review packet workflow — 2026-11-06

Offline `npm run prepare:eyra:annotations` prepares two separate reviewer
packets from a strict **source-only** manifest. A manifest with model answers,
labels or extra metadata is rejected. Packet order is reproducibly seeded,
and reviewer outputs must be collected separately before model exposure.
The offline evaluation tool now reports exact agreement and Cohen's κ per
domain; a written resolution is required for every disagreement or override.
This is only infrastructure. No real experts have independently annotated
source claims here, so the scientific acceptance gate remains **NO-GO**.


## Human annotation hand-off integrity — 2026-11-06

The integrated candidate includes an offline `reconcile:eyra:annotations`
step. It checks the source manifest's SHA-256 and the expected blinded
packet structure, prevents edits to scientific claims or abstracts between
reviewers, refuses unfilled verdicts and writes only a non-overwriting
**draft**, preserving both original decisions and disagreements. This is a
workflow guard; it does not supply actual independent human evaluations or
a certified scientific dataset. Human study and staging gates remain NO-GO.


## Verified release preflight — 2026-11-06 (no promotion)

See `docs/RELEASE_ACCEPTANCE_2026-11-06.md` and the offline
`npm run audit:release -- --snapshot docs/RELEASE_PREFLIGHT_SNAPSHOT.example.json`.
This read-only inventory records the actual Vercel key **names**, unchanged
production commit, unrelated connected Supabase ref and presence of a
live-mode Stripe account (not authorization to charge). The connected
workspace lacks access to the intended Supabase project; Stripe server
credentials are absent from Vercel's returned list. Account deletion is
still design only, and independent human EYRA evaluation has not happened.
**Release decision remains NO-GO**; the script deliberately does not
certify a GO even when evidence has been self-declared complete.
