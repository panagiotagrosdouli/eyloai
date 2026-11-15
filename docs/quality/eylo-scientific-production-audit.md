# EYLO Scientific & Production Quality Audit — acceptance protocol

**Status (2026-11-16):** audit plan plus automated guardrails; **not** a release approval, production penetration test, WCAG 2.2 AA audit, scientific peer review, verified AI accuracy score or human usability result.

## Evidence levels

| Level | What it proves | What it does not prove |
| --- | --- | --- |
| Code contract / unit test | The implemented validation and specified fixtures behave as expected | Live data quality or hosted availability |
| Authenticated browser fixture | A bounded route and workflow operate in a controlled isolated environment | Real user success, real-world authorization or domain validity |
| Consented staging verification | Observed persistence, access-control isolation and sources on an owner-confirmed staging target | Production reliability or formal accessibility conformance |
| Expert / participant assessment | A recorded judgment for named test prompts and actual users, with denominators and limitations | Universal scholarly accuracy or statistical generalizability |
| Owner-reviewed release gate | Evidence was checked for a specific commit and environment | Permission to merge or deploy without explicit owner authorization |

## A. Scientific EYRA evaluation

Use a frozen set of at least 20 *newly curated, non-private* prompts across literature synthesis, conflicting findings, methods, statistical uncertainty, research gaps and questions with no retrievable evidence. An academic domain reviewer inspects each retrieved original before adjudicating. Track:

- **Citation identity validity:** cited IDs must resolve to actual retrieved records.
- **Citation support:** does the named source substantiate the *specific sentence*, not merely share keywords?
- **Metadata fidelity:** DOI, title, year, author, provider and URL should match publisher/cross-referenced records where available; report conflicts.
- **Unsupported assertions:** record fabricated facts, unwarranted causal language and unsupported novelty claims.
- **Abstention quality:** when tools fail, distinguish *no records returned* from *no research exists*. Test malicious provider titles and unsafe URLs.
- **Safety and privacy:** measure prompt-injection resistance, user-owner access and whether private research leaks into prompts or analytics.
- **Human scoring:** record valid/invalid/uncertain per claim, source URLs and anonymized reviewer disagreement; never compute a success percentage without denominators.

Unit tests protect citation identifiers and fallback messaging only. They **cannot** prove individual scientific claims are true. A source icon is not a verification badge.

## B. Authorized research end-to-end

On two owner-confirmed synthetic staging accounts, complete: create project; discover and open an original publication; save a project-linked paper; reload; human screening decision and protocol; compare at least two papers with a counterexample; save a note; create and export a thesis outline; reload all records. Include a newly created project and an older project outside the first 100 rows. Check record IDs, authorized reads, no cross-user leakage, failure recovery and exports. Never perform this with production user data without consent.

## C. Accessibility / mobile

Automate viewport routes at 320, 390, 768, 1024 and 1440 pixels, light/dark and reduced motion. Collect route failures, horizontal overflow and page exceptions; **optional** screenshots may contain private information and require synthetic accounts, consent and controlled storage. Manual WCAG 2.2 AA review remains required: skip link, keyboard focus and return, focus indicators, headings, labels, error announcements, contrast and screen reader flows. Record device/browser and assistive-technology version. A green smoke test is not certification.

## D. Performance / resilience

For each target route on the **same device/network profile**, report sample counts, median and p75 of LCP, CLS, INP (after a representative interaction), navigation cost, bundle transfer and errors. If unsupported or absent, retain `null` / **not measured**. Separately test slow provider responses, 401/403 authorization recovery, offline mode, explicit cancellation, and exhausted evidence pools. Review frontend and backend logs without storing research topics, note contents, tokens or account identifiers.

## E. Security / privacy / operations

Have a qualified reviewer verify staging RLS with two distinct accounts, session expiration, request limits, private object access, consent, deletion and account export behavior, environment secrets, official-source URLs, dependency vulnerabilities, third-party API failure handling, storage retention, encrypted backups and **tested restore**. A checked box without an immutable evidence artifact is not proof. Review privacy notices and legal terms with an appropriately qualified professional.

## F. Pilot usability evaluation

Run the seven tasks in `docs/eylo-2030-usability-protocol.md` with informed consent and synthetic workspace content; sample undergraduate and postgraduate participants, first-time researchers and assistive-technology users. Track task completion per participant, intervention counts, time to first action, backtracking, confusion/error categories, task difficulty and user confidence (1–5). Report successes over actual attempts, not over all planned tasks. No recordings without explicit consent. An investigator must decide whether enough participants and disciplines were sampled; do not present a pilot as population-level validation.

## G. Production decision: fail closed

For the precise head SHA and owner-confirmed staging environment, first run `npm run check`, protected CI workflows, then authorized smoke tests and RLS isolation, source audits and usability evidence. The repository's existing `npm run release:readiness` remains a conservative release-evidence check; it does not authorize production itself. Outstanding critical accessibility, auth, citation or data-loss findings mean **NO-GO**. Record owner approval, change window, monitoring owners, rollback test and backup restore before any deployment.

### Current audit observations

- The EYRA fallback formerly described retrieved metadata as `verified records`; this audit changes it to clearly labelled *source records (not independently verified)* and guards unsafe fallback markdown links.
- The source citation interface now labels source records as retrieved rather than independently verified; identifier integrity remains explicitly distinct from claim-support verification.
- Actual staging accounts, scientific reviewer findings, pilot-participant scores, performance percentiles, full manual WCAG inspection, penetration-test report, backup restore and operational sign-off: **not measured / not performed**.
- This audit branch must remain draft until the owner reviews the results. **Do not merge or deploy automatically.**
