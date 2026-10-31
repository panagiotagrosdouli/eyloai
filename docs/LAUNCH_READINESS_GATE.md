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
- Reviewed production commit: `c51b1118e4f8208d478d120cc3d642d30a612296` (PR #189); Vercel deployment `dpl_4r9vtR9mged3x2mEZ2o8FRySwJFF` is `READY` and is aliased to the production domain.
- PR #189 passed the Vercel status check. Local `npm run check` passed with 113 tests, typecheck, lint, and production build. The deterministic anchor diagnostic passed 5/5 fixtures.
- Production public smoke checks passed 8/8: landing HTML, release manifest, robots policy, discovery route, login route, registration route, password-recovery route, and server capability endpoint.
- Production capabilities: AI available, billing disabled, scheduled monitoring unavailable, institution analytics available. No live charges were enabled.
- The live proxy benchmark returned results for all 5 queries but had source coverage warnings in 5/5: only OpenAlex and Crossref were consistently available (2/5 indexes). Europe PMC returned HTTP 503, Semantic Scholar HTTP 429, and arXiv did not return an HTTP status during this run. Average heuristic anchor coverage was 0.00 because the source coverage gate was not met; this automated diagnostic is not human-judged relevance.
- PR #189 makes the UI and EYRA warnings show sanitized provider HTTP statuses. Provider availability can change, so repeat the live check before launch.

These checks do not prove cross-user Supabase RLS, authenticated persistence/deletion, EYRA scientific accuracy, complete DOI metadata fidelity, mobile coverage, or payment flows. Keep all launch-gate boxes unchecked until their own evidence is recorded.
