# EYLO — evidence-first scale blueprint (2026)

> Status: proposed strategy, not a claim of achieved traction, scientific performance, partnerships or revenue.

## North star
Help a researcher reliably turn a research question into a verified, saved, actionable evidence trail. Optimize for repeat research success rather than feature count or vanity metrics.

## Target segment and positioning
- Initial ICP: MSc/PhD students and academic research assistants conducting structured literature discovery and maintaining project context.
- Primary job: find, verify, organize and revisit credible literature; then plan the next research action.
- Differentiation hypothesis to test: source-linked discovery + private persistent project context + explicit uncertainty + researcher/opportunity workflows.
- Validate against workflows involving Google Scholar, Semantic Scholar, Elicit, ResearchRabbit, Zotero and generic AI chats. No unsupported superiority claims.

## Phase 0 — unblock reliability and establish baseline (weeks 1–2)
1. Restore green CI across build, import checks, typecheck, lint and unit tests; track failures with owners and dates.
2. Test sign-in, public research discovery, saving, reloading and exporting evidence, project association, EYRA citations and Stripe entitlement edge cases end-to-end.
3. Record baseline latency (p50/p95), 5xx rate, provider timeouts, failed searches, retrieval source coverage and exception frequency.
4. Verify row-level security policies and server-only key boundaries; check every public/authenticated route for proper access behavior.
5. Publish user-facing limitations and incident channels. Do not claim production reliability without measured evidence.

Exit gate: CI consistently green, no known critical auth/data-isolation defects, baseline dashboard created.

## Phase 1 — prove discovery quality (weeks 2–5)
1. Create a consent-safe, expert-reviewed evaluation set: 50–100 real research queries across ML, robotics and adjacent disciplines; stratify by easy/ambiguous/niche/recency.
2. For each query, independently label relevant records and record sources, freshness, duplicate handling and retrieval failures.
3. Report Precision@10, Recall@k where judgment pool permits, nDCG@10, source-link validity, duplicates, p95 latency and coverage. Never infer unbiased recall from an incomplete judgment pool.
4. Add repeatable benchmark fixtures and regression thresholds to CI, with documented exemptions for upstream changes.
5. Ensure EYRA only cites retrieved verified IDs/URLs; display a visible distinction among metadata, abstracts, inference and unsupported assertions.
6. Add user-facing correction/report issue actions and measurable quality feedback.

Exit gate: published protocol, transparent benchmark and improvement over baseline in independently judged tasks.

## Phase 2 — retention and usable workflow (weeks 4–8)
1. Deliver a fast 3-minute first-run journey (question → source-backed result → optional project save).
2. Prioritize persistent projects, notes linked to evidence, deduplication, tags, source history and exports (BibTeX/RIS/CSV where formats are applicable).
3. Add shareable read-only evidence trails with explicit opt-in, private-by-default access and revocation.
4. Test keyboard navigation, screen-reader labels, mobile flows, loading/error/empty states and retries.
5. Instrument privacy-preserving funnels for search success, saved first paper, returning active researchers and project completion. Get consent where necessary and avoid recording queries or sensitive project text by default.

Exit gate: cohorts show repeat usage for meaningful research actions, not just page views.

## Phase 3 — monetization and trust (weeks 6–10)
1. Interview at least 15–25 target users; observe real workflows, willingness to pay and reasons for abandonment.
2. Pilot free and paid plans with clear usage caps and transparent source/API costs; do not invent plan benefits or price points without tests.
3. Verify server-authoritative entitlement checks, Stripe webhook replay/idempotency, cancellation/refunds, downgrade and payment-failure cases.
4. Implement deletion/export, retention policy, privacy policy and security vulnerability reporting; address EU/GDPR obligations with qualified review.
5. Explore institutional pilots only after individual-workflow quality and security are demonstrated.

Exit gate: evidence of value and sustainable unit economics, not a vanity revenue target.

## Phase 4 — distribution and scalable operations (weeks 9–13)
1. Publish research methodology, evaluation benchmarks, explainer content and public product docs.
2. Launch 2–3 narrow communities/channels and track sign-up → first evidence save → week-4 retained-user conversion.
3. Define support SLAs for the current team capacity, runbooks, incident response and usage-based cost alarms.
4. Explore researcher ambassadors and university lab pilots with explicit consent; never imply formal affiliation before signed agreements.
5. Revisit internationalization, institutional SSO and team collaboration only if demand validates them.

## Metrics and decision rules
- North-star: weekly users who complete a verified research task (save and revisit a source-backed evidence trail).
- Activation: first meaningful saved evidence trail within initial session.
- Retention: weekly active research-task cohorts and week-4 repeat completion.
- Trust: valid-citation rate, broken source links, factual issue reports and resolution time.
- Reliability: CI pass rate, crash-free sessions, p95 latency, search/provider failure rates.
- Business: qualified activation, paid conversion, net revenue per active account, gross margin, churn and support cost.
- Review metrics weekly and only expand feature scope when a bottleneck is measured.

## Prioritization rubric
Score work on user pain, frequency, research trust, confidence, engineering effort, risk and expected cost. Fix security and correctness before growth experiments. Use experiment briefs: hypothesis, target cohort, success metric, stopping condition, owner, rollback.

## Explicit non-goals until evidence supports them
- General-purpose chatbot competition
- Autonomous research conclusions without sources
- Fabricated supervisor availability, academic ranks, funding eligibility or collaborations
- Enterprise claims without controls, contractual readiness or pilots
- Mass outbound marketing, dark patterns, fabricated testimonials or unverified metrics

## Implementation contract for coding agents
1. Inspect the repository and current CI before edits; do not assume this document reflects shipped functionality.
2. Create one scoped branch and PR per phase or coherent feature.
3. Prefer the smallest reversible patch.
4. Add tests for any business or scientific correctness behavior.
5. Never expose secrets in client bundles or logs, or modify production billing without explicit review.
6. Run `npm run check` and relevant integration tests; report failures transparently.
7. Include screenshots of UI edits when feasible, migration/rollback notes for schema edits, and real results rather than invented pass claims.
