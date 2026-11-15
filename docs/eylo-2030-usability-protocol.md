# EYLO 2030 — Usability and accessibility validation protocol

**Status:** Test design only. No participant sessions, task completion scores, screenshots or WCAG certification have been reported.

## Participants and setup

Recruit a mix of first-time undergraduate students, postgraduate researchers and experienced researchers. Use consented non-sensitive test accounts with realistic but synthetic projects, papers, deadlines and opportunities. Include keyboard-only and screen-reader users, and mobile participants at 320 and 390 px. Never ask participants to upload confidential research, medical records or unpublished grant applications.

Use a standardized start state and record a screen capture only with consent. Do not interpret tool completion based on a toast alone: verify persisted records and official retrieval source links.

## Six unassisted tasks

| Task | Start | Success evidence | Key failure signals |
| --- | --- | --- | --- |
| Find a scientific publication | Authenticated Home | A genuine result with an accessible source link | Unclear search, no result provenance, inaccessible controls |
| Save a publication to Library | Discovery results | Saved paper visible in Library after navigation/reload | False success, unsaved state, duplicate records |
| Create a research project | Home or workspace | Project persisted and accessible through a stable deep link | Unclear creation, form overload, lost draft |
| Ask EYRA for help | Any workspace | Actual conversation response or clearly explained failure; no synthetic sources | Hidden launcher, focus trap, opaque status, unsupported claims |
| Create a study plan | Home or Learn | Study session/exam item saved, visible in planner | Overwhelming options, unannounced validation, missing save feedback |
| Find a funding opportunity | Home or Discover | Official record/source displayed, source and deadline distinguishable | Stale claims, unclear eligibility, false funding-match certainty |

## Measurement

Collect per task: first meaningful action time, first target discovery time, interaction count to start, successful completion, request failures, navigation backtracks, user confidence (1–5), and any observer assistance. Record denominator and participant distribution. Proposed targets are **unverified**: first action under 30 s, common workflow started within 3 interactions, essential task completion at least 90% without help, zero critical keyboard/mobile blockers.

## Accessibility and responsive matrix

- Viewports: 320, 390, 768, 1024, 1440; light and dark themes; reduced-motion preference.
- Manual keyboard: skip link, primary nav, directory filters/search, modals, recovery, Escape close and focus return.
- Assistive technologies: screen reader page titles/headings, form labels/instructions, live statuses, validation errors, saved results and links.
- Contrast: text, controls, focus indicators and informational states against WCAG 2.2 AA criteria.
- Browser performance: measure navigation, LCP, CLS, INP and bundle size on the **same device/network profiles** before and after changes.

## Automation

- `npm run check`: imports, typecheck, lint, unit tests and production bundle.
- `npm run test:e2e:ux`: opt-in read-only authenticated route/viewport/theme smoke tests. Supply `EYLO_E2E_BASE_URL`, `EYLO_E2E_STORAGE_STATE` and optionally `EYLO_E2E_ARTIFACT_DIR`. No credentials should be checked into Git. Use only authorized, synthetic, non-sensitive test accounts.
- With `EYLO_E2E_ARTIFACT_DIR`, the suite writes `ux-observations.json` and `ux-summary.json` (sample sizes, missing-data counts, medians and p75 per route). It records only static route paths, viewport/theme and bounded lab measurements, not workspace titles or research queries. Browser exceptions are counted without recording messages.
- **Screenshots are disabled by default**, even when an artifact folder is set. For consented synthetic accounts only, explicitly set `EYLO_E2E_ALLOW_SCREENSHOTS=1`; review and delete screenshot artifacts according to your organization's retention policy.
- LCP can remain `null` when no valid entry was observed; unsupported CLS is `null`, while a supported observed zero CLS is a legitimate lab result within the observation window. INP remains **not measured** (null) because the suite does not exercise representative interactions. A 500 ms post-readiness sampling window is not a field Core Web Vitals measurement or a basis for production thresholds. Interpret p75 cautiously for tiny samples; compare the same browser/device/network configurations, ideally with repeated runs.
- Existing discovery, funding, learning, product and EYRA integration tests should be rerun. This suite is not a substitute for real-task validation.

## Release gate

Do **not** merge or deploy until the current head SHA passes CI and authenticated visual inspection, failures are triaged, first-time pilot sessions are completed, and the owner authorizes deployment. Unsupported measurements must remain marked **not measured**.
