# EYLO — research validation, pilot and release gates

Last updated: 2026-11-07

This is an **execution plan**, not evidence that a pilot, security audit or benchmark has been completed.

## Gate 1: production smoke and accessibility

Test the actual production URL and deployed commit; a merged GitHub PR is not proof of live deployment.

- Verify HTTP status, navigation, logo, responsive layout at 360px / 768px / 1440px.
- Keyboard-only: skip link, search submission, menu, focus visibility and tab order.
- Screen reader: heading hierarchy, form labels, loading/error announcements.
- Discover without login; open original records; handle partial provider failures.
- Register/login/recovery, save paper, create project, use EYRA on saved context.
- Test empty query, no results, slow source and unexpected provider failure.
- Record evidence: timestamp, deployment SHA, browser/device, outcome and screenshot (excluding user data).
- Block release for a broken primary search, inaccessible navigation, wrong redirects or leaked private data.

## Gate 2: scientific retrieval quality

Existing deterministic tests are regression checks, **not** a scientific validation set.

1. Pre-register 50–100 questions distributed across robotics/engineering, biomedical, environment, social science and interdisciplinary research. Cover novice/expert and recent/foundational intents.
2. For each question, freeze the exact query configuration, provider status, retrieved top-10 IDs and retrieval timestamp.
3. Independently pool candidates and obtain two human relevance judgments on 0/1/2 scale (irrelevant/partly/highly relevant). Adjudicate disagreements; report agreement.
4. Never invent judgments or use LLM-generated judgments as a substitute for expert labels.
5. Run `node scripts/evaluate-human-judgments.mjs <path-to-judgments.json>`.
6. Report Precision@5, Precision@10, nDCG@10, duplicate rate, incomplete judgments and subgroup results. Also record provider availability and latency separately.
7. Compare the same question pool against at least one transparent baseline (e.g., one scholarly index sorted by native relevance), respecting API terms. No unsupported claims of superiority.
8. Include confidence intervals and a qualitative analysis of off-topic records before making public accuracy claims.

The input format is documented in the script. A query lacking complete top-10 judgments is explicitly **unscored**.

## Gate 3: grounded EYRA evaluation

- Prepare 30–50 scientific questions with frozen evidence packets.
- Human review: factual support, citation correctness, unsupported claims, uncertainty calibration, abstention when no evidence, and safety.
- Adversarial cases: conflicting abstracts, withdrawn/incorrect records, prompt injection in metadata, missing sources and out-of-domain questions.
- Record model, prompt version, evidence snapshot, provider failures, response and reviewer verdict.
- EYRA output must remain labelled as AI synthesis, not established scientific consensus.
- Block launch claims about reliability without measured results.

## Gate 4: authenticated data security

- Validate cross-user isolation using **dedicated test accounts**; test every user-owned entity and RLS policy.
- Ensure Stripe entitlements and webhooks rely on server-verified identity and signatures.
- Review OAuth redirects, password recovery, session expiry, IDOR, injection and rate control.
- Confirm no service-role secrets or API keys enter the browser bundle, logs or Git history.
- Review retention, deletion requests, privacy notice and jurisdiction-specific terms.
- Do not run destructive tests on real user accounts or publish secrets in reports.

## Gate 5: researcher pilot

Recruit 10–15 consenting participants across students, MSc/PhD researchers and other disciplines.
Do not claim participants, institutional endorsements or university partnerships until confirmed.

**Consent and ethics:** Explain voluntary participation, task recording and data handling. Obtain necessary institutional ethics approval if the study requires it. Use synthetic tasks where feasible.

**Tasks:**
1. Start from a research question and identify two useful sources.
2. Inspect provenance and identify where EYRA is generating an inference.
3. Save one source and create a related project with a milestone.
4. Export a citation and find the original record.
5. Locate a researcher and understand what the platform can and cannot verify.

**Measurements:** Task success, time on task, critical errors, SUS or other validated usability measure, source inspection rate, qualitative confusion points and user-reported trust. Do not equate clicks with scientific validity.

**Exit criteria:** Fix blocking UX/security defects; publish transparent evaluation results; verify deployment and legal/privacy readiness before broad recruitment.

## Deployment acceptance record (fill with actual evidence)

| Check | Evidence / result |
|---|---|
| Production URL and commit | NOT VERIFIED |
| CI test/build | NOT VERIFIED |
| Mobile/desktop/browser checks | NOT RUN |
| Human-judged retrieval evaluation | NOT RUN |
| EYRA evidence audit | NOT RUN |
| Cross-user RLS test | NOT RUN |
| Researcher pilot | NOT RUN |

Never replace these statuses with "passed" without reproducible evidence.
