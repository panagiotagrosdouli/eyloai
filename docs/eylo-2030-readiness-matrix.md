# EYLO 2030 — Seven-workstream delivery and evidence register

**Scope:** follow-up changes in the draft Research Journey PR. **Evidence classification:** implemented code, automated checks, opt-in checks, and human validation remain distinct. Nothing in this document certifies WCAG compliance, source accuracy, usability success or production readiness.

| Workstream | Concrete delivered increment | Evidence available | Not yet demonstrated |
| --- | --- | --- | --- |
| 1. Unified navigation | Protected Research Journey entry from Home, Tools, Projects and Project Detail; five connected project-scoped steps | Route and integration unit contracts; CI build | Task-based navigation success with first-time users |
| 2. End-to-end research flow | Project, discovery, Library, evidence comparison, methods protocol, Notes/Thesis links | Real existing storage/read paths; unit contracts | Real authenticated end-to-end journey with source inspection and saved draft export |
| 3. Scientific EYRA | An explicit human-review step, source metadata caution, and separate EYRA launch with capability gating | Static and unit tests for scientific-claim wording | Formal citation-grounding evaluation, hallucination analysis, domain-expert review |
| 4. Thesis workspace | Project-specific deep link to existing Thesis Studio and canonical Notes | Existing thesis contract plus journey integration test | Participant-authored, end-to-end thesis and citation workflow |
| 5. Mobile and accessibility | Structured headings, labels, focusable 44px-height actions, accessible loading/error/empty states; optional 5-width light/dark UX suite | Build/lint and optional authenticated Playwright scripts | Screen reader evaluation, WCAG 2.2 AA manual audit, real-device touch measurements |
| 6. Reliability and performance | Read-only authorized project resolution; partial paper load distinction; bounded 100-record coverage disclosed; retry on failed data loads | Failure-state unit coverage, CI, existing product workflows | Hosted RLS probe with authorized test accounts, Web Vitals and load comparisons |
| 7. User testing | Six-task protocol extended with a seventh full journey task | Defined tasks and success criteria | Consent-based sessions with students/researchers, observed completion, confidence metrics |

## Scientific acceptance rules

1. A saved scholarly record is only metadata until the researcher opens the source; no saved record is automatically verified.
2. A candidate research gap is a hypothesis supported by a limited evidence sample, not proof of absence of prior work.
3. Recorded protocol fields do not establish PRISMA compliance or systematic review completeness.
4. Human screening decisions, manuscript Notes and thesis chapters remain author-controlled. A guide never silently changes their contents.
5. Any failed source or paper-collection read must be labelled as **unavailable**, not zero results. Page-level bound counts cannot claim exhaustive coverage.
6. AI advice must remain distinguishable from independently cited research evidence.

## Seven-task user evaluation

Using only consented synthetic test accounts, give each participant this additional full-journey task: **Open a project from Home; identify a citable source, save it, inspect the project's recorded evidence, document a reproducible screening protocol and reach the project's Thesis Studio without losing saved work.** Success requires verifying the actual persisted paper, project, human decision and thesis outline after reload; a toast or route transition alone is not proof.

Capture screen width, theme, device and assistive technology; attempted tasks, outcome, assistance count, time-to-first-action, navigation backtracks, errors, user confidence and qualitative complaints. Keep raw transcripts private and do not log research queries or unpublished notes through analytics. Compare first-time participants and experienced researchers separately. The 30-second first-action and 90% unassisted task-success targets remain **proposed**, not measured.

## Validation gates for a reviewer

- [ ] `npm run check` and all branch CI jobs pass on the exact head SHA.
- [ ] Authorized read-only `npm run test:e2e:ux` run at 320, 390, 768, 1024 and 1440px in light/dark, with explicit screenshots and observed errors.
- [ ] Two test projects (recent and older-than-recent-list) load by exact owner-authorized project ID without substituting a different project.
- [ ] A failed SavedPaper request shows unavailable coverage; a successful empty response shows zero linked papers.
- [ ] A source link opens the original scholarly source and no AI suggestion is presented as verified fact.
- [ ] Research Gap Finder, Literature Review and Thesis Studio preserve records across reloads and project switching.
- [ ] Keyboard-only navigation, focus order, heading structure and Escape behavior are manually tested.
- [ ] Screen reader and WCAG 2.2 AA review completed by qualified testers, issues fixed and retested.
- [ ] Performance baseline and comparison: LCP, CLS, INP, navigation latency and transferred JS on identical device/network.
- [ ] Consented participant sessions and task metrics are completed with denominators and no fabricated results.
- [ ] Owner explicitly approves merge and deployment after remaining blockers are resolved.

**Current evidence limit:** no authenticated production account was used for this document; browser screenshots, independent source checks, formal accessibility certification, actual Web Vitals and human participant outcomes remain **not measured**.
