# EYLO research quality — measured release slice (16 Nov 2026)

This change is **software and evaluation instrumentation**, not a scientific accuracy claim, an accessibility certification, a usability study, a deployment or a production release.

## Delivered in this slice

- Fix the real mobile *All tools* menu issue: a global outside-click listener previously closed the directory on a tap inside the mobile menu. It now distinguishes the desktop tools dropdown from the mobile navigation panel. The Playwright product fixture verifies opening the directory, entering “funding”, finding the expected link, and Escape/focus behavior.
- Add a reviewer-only EYRA scientific quality evaluation. Link identity, **claim actually supported by original source**, missing-evidence disclosure, unauthorized writes and duplicate writes are separate measures. Counts, denominators, zero-denominator null values and domain breakdowns are explicit.
- Report Wilson 95% descriptive intervals for proportions; **do not treat claims within the same paper or query as independent observations** or imply these intervals establish generalization.
- Allow only broad domain categories in exported reports to reduce inadvertent leakage of sensitive project/topic text.
- Enforce a production chunk regression ceiling of **700,000 minified JS bytes per chunk** in the normal build. The latest checked main Build workflow (commit `8da380e914`) reported `MeetingRoom` 593.45 kB minified / 156.17 kB gzip, with `index` at 491.91 kB minified. This protects against *chunk growth only*: it is not LCP, INP, CLS, bundle transfer, or real-user latency.

## Scientific evaluation procedure

1. Recruit authorized, independently qualified academic assessors and create at least **50 frozen research prompts** with retrieved source snapshots, with appropriate ethics/consent and no real private user data.
2. Each source identifier must be checked against the retrieved packet. Each substantive claim must be read against its **actual cited source text**, not just abstract title or DOI. Mark both as human boolean verdicts; uncertain cases require adjudication, not an automatic pass.
3. Use the predefined domain labels: `biomedical`, `engineering`, `computer-science`, `environment`, `social-science`, `interdisciplinary`, `other`.
4. Generate a *blank* review worksheet using:

   `npm run benchmark:eyra:human -- template reviewer-labels.json`

   Fill a pseudonymous reviewer code, unique case IDs, broad domains, citation-level identity labels, claim-level evidence support labels, no-evidence disclosure and write-safety counts. The deliberately `null` labels **will not pass** evaluation.
5. Run `npm run benchmark:eyra:human -- evaluate reviewer-labels.json eyra-audit-report.json`. The report includes only aggregate metrics and no individual prompts, URLs or reviewer codes. **No result has been generated from actual reviewer judgments by this PR.**
6. Compare source-supported claims by domain and failure mode, review adverse cases and record reviewer agreement separately. The reported Wilson intervals assume independence and may be optimistic. Do not announce an accuracy percentage or superiority over other tools without proper sampled judgments and an equivalent, audited baseline.

## Release gate and unresolved work

- `npm run check`, protected GitHub CI and `npm run test:e2e:products` must pass for the exact head commit.
- Run the opt-in authenticated UX smoke script at 320, 390, 768, 1024, 1440 widths, dark/light and reduced-motion using a synthetic owner-approved test account. Use sampled LCP/CLS observations and realistic interactions to measure INP separately; do not invent timings.
- Require a READY preview at the exact SHA and review security, accessibility (including a manual WCAG 2.2 AA audit) and backup/restore evidence.
- Perform real cross-account RLS, EYRA action approvals and retry tests on an owner-authorized staging environment. Do not enable the durable agent-run flag or run database migrations automatically.
- Conduct consented usability sessions under `docs/RESEARCH_VALIDATION_AND_PILOT.md` and `docs/quality/eylo-scientific-production-audit.md` before claiming research success.

**No-go by default** if scientific evidence labels, usability evidence, deployment status or required security validation are missing. This feature branch contains no remote writes or production deployment steps.
