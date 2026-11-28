# EYLO commercial readiness review — 28 November 2026

**Decision: NO-GO for public beta, paid beta, or general commercial release.**

**Highest supported launch mode: MODE A — internal development.** This is the highest status supported by evidence in this repository. CI fixtures, public read-only requests, and a protected Vercel preview do not establish authorized user testing. Move to MODE B only after the owner identifies an approved test environment and accounts; do not infer that authorization from a ready preview.

This review is an implementation and evidence index, not legal advice, scientific validation, or release authorization. It records source and CI evidence separately from hosted acceptance.

## Smallest coherent researcher release

Keep the release to these workflows:

1. Sign up, sign in, and recover an account.
2. Create and reopen a private research project.
3. Search scientific indexes, inspect source records, and save publications to that project.
4. Ask EYRA questions about supplied or retrieved evidence, with source links and clear uncertainty labels.
5. Draft a literature review, methodology, academic proposal, and grant proposal from project evidence.
6. Review claims and call requirements, edit drafts, and export a document.
7. Reopen the project after reload and prove that a second account cannot read or alter its data.

The application contains these source workflows and extensive local/CI regression coverage. They are not yet a verified hosted product: no accepted two-account staging run, authenticated real-provider EYRA run, researcher-rated scientific packet, or end-to-end hosted persistence run is recorded. Treat the minimum release as a target, not a claim that all seven workflows have passed with researchers.

### Feature availability and honest presentation

| Area | Current evidence | Product treatment until acceptance |
|---|---|---|
| Auth, projects, evidence, research documents, proposals, evaluation and export | Implemented source paths and regression suites; hosted identity, RLS and persistence acceptance are absent | Keep behind the signed-in product; do not claim cross-account security or durable hosted acceptance |
| Literature discovery | Production browser observation returned 24 deduplicated records from 3 of 5 indexes; OpenAlex and Semantic Scholar returned HTTP 429 and the interface disclosed partial retrieval | Say discovery can be partial; retain provider status and retry affordances; avoid accuracy or coverage claims |
| EYRA | Provider/quota guards and source-grounding paths exist; no authenticated provider completion and independent claim review on the candidate are recorded | Clearly label as AI-assisted drafting; make no scientific-validation or accuracy claim |
| Billing and paid entitlements | Production capability manifest has billing disabled; Stripe test lifecycle is not evidenced | Keep checkout, paid-plan activation and premium marketing unavailable |
| Contact and support delivery | Production capability manifest has contact delivery disabled; no functioning support workflow is verified | Show a real support address/process only after an owner supplies and tests it; do not leave an enabled dead link |
| Optional product modules | Repository inventory records 77 modules as partial | Hide or label unfinished modules; advertise only the verified core workflow |

## Acceptance evidence available and absent

| Gate | Current status | Boundary / next evidence |
|---|---|---|
| Source and CI | Exact integrated candidate head `ea98c5715ccc344ababb9abda4fcd5135921b50e` passed Product Quality [46150599747](https://github.com/panagiotagrosdouli/eyloai/actions/runs/46150599747), Build [46150599781](https://github.com/panagiotagrosdouli/eyloai/actions/runs/46150599781), EYLO Quality Gate [46150599751](https://github.com/panagiotagrosdouli/eyloai/actions/runs/46150599751), disposable PostgreSQL preflight [46150599731](https://github.com/panagiotagrosdouli/eyloai/actions/runs/46150599731), and Vercel. The curated restoration replay now includes SHA-pinned meeting-participant, learning-progress policy and FK-index migrations. Exact preview `dpl_58U6ksrD1RsBzk5sJczq4KdNgA8P` returned HTTP 200 at its public root. Hosted staging/account acceptance is still blocked by Free project quota. | Re-run exact-head checks after any source change. |
| Local verification | `npm run check` passed on current main: imports, both TypeScript projects, lint, 1,326 tests, production build and bundle budget. | This is local source verification and is not the newer PR's exact-head result. |
| Migration/RLS | PR #631 records 19 observed production migration versions, 18 exact fingerprints, one known historical divergence and a pending forward-only policy correction. PR #632 adds negative ownership checks; disposable CI PostgreSQL preflight passed. | Hosted history, staging RLS, backup evidence and production application remain separate. Never apply the pending migration to production from this report. |
| Real researcher acceptance | NOT RUN | Use an isolated owner-confirmed staging project, two disposable accounts and synthetic data. Exercise search → save → EYRA → literature review → methodology → academic and grant proposals → export → reload → account isolation. |
| Human scientific review | NOT RUN | Freeze the candidate and evidence packet; recruit qualified independent reviewers; report claim support, citation validity, uncertainty, methods and call compliance by dimension. |
| Paid billing | NOT VERIFIED; DISABLED | Test-mode checkout, signed webhooks, entitlement expiry/revocation, failed payment, renewal, cancellation and billing portal. Require `test_mode=true` and `livemode=false`. |
| Security / privacy / operations | INCOMPLETE | Resolve leaked-password protection, two-user access, data export/deletion, monitoring, backup/restore and incident response before an external pilot. |
| Legal | NOT REVIEWED | Confirm controller identity, jurisdiction, retention, subprocessors, research rights and consumer cancellation/refunds with qualified counsel. |

The current authorized path is **MODE A**. MODE B requires an owner-designated, synthetic-data test environment plus confirmed identity, rollback boundary, private test credentials, and explicit approval for any account or data writes. MODE C additionally requires hosted two-account acceptance, support and incident handling, legal/privacy review, and human researcher evaluation. Do not progress to public beta or paid modes while their evidence is absent.

## Reproducible, assumption-based cost model

There are no measured production token counts, provider invoices, cloud invoices, support logs, or active-user cohorts in the checked-in evidence. The following is a transparent planning scenario, **not measured unit economics**.

The API source defaults `OPENAI_MODEL` to `gpt-5.6`. The public rate reference retrieved on 28 November 2026 lists GPT-5.6 Sol at $4 per million input tokens and $20 per million output tokens. The repository's configured identifier does not prove that the deployed account is billed at this exact SKU/rate. Validate model identity and invoice rates before using these estimates for pricing. See [OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

Illustrative workload and arithmetic at that rate:

| Operation | Assumed input / output tokens | Estimated model cost |
|---|---:|---:|
| Short EYRA chat | 5,000 / 1,000 | $0.04 |
| Literature review | 40,000 / 5,000 | $0.26 |
| Methodology draft | 20,000 / 4,000 | $0.16 |
| Academic proposal | 30,000 / 8,000 | $0.28 |
| Grant proposal | 40,000 / 10,000 | $0.36 |

Example active month: 10 chats, 2 literature reviews, 1 methodology, 1 academic proposal and 0.25 grant proposals. This totals 190,000 assumed input and 34,500 output tokens, or $1.45 at the reference rate. Applying an illustrative 10% retry/overhead factor gives **$1.60 per active user-month for model tokens only**. No operations have been measured; prompt size, model choice, retries, cached input, reasoning tokens and document length can move this materially. A tenfold heavy-use pattern costs about $16 per user-month before search, storage, hosting and support.

| Monthly active users | Illustrative AI token spend at $1.60 / user | Example fixed baseline* | Combined reference subtotal | Reference subtotal / active user |
|---:|---:|---:|---:|---:|
| 10 | $16 | $45 | $61 | $6.10 |
| 100 | $160 | $45 | $205 | $2.05 |
| 1,000 | $1,600 | $45 | $1,645 | $1.65 |
| 10,000 | $16,000 | $45 | $16,045 | $1.60 |

\* The $45 example is one Vercel Pro base at $20/month plus one Supabase Pro base at $25/month, before extra seats, usage, compute, storage, tax or add-ons. It is a published-price reference, not a verified EYLO bill, selected plan or purchase authorization. Vercel describes a $20 Pro platform fee and included usage credit; Supabase lists Pro at $25/month and daily backups with seven-day retention. See [Vercel pricing](https://vercel.com/pricing) and [Supabase pricing](https://supabase.com/pricing). No upgrade or spend was performed.

| Cost component | Model input / evidence needed |
|---|---|
| AI input/output tokens | Model SKU × token counts by operation; collect aggregate counts and invoice totals without research content. Current operation counts above are assumptions. |
| Search providers | Record calls by provider and check each commercial tier, API terms and any key quota. Crossref public REST is free; Europe PMC describes public APIs as free; Semantic Scholar's API page gives an introductory 1 request/second key limit. Those facts do not prove total commercial search cost is zero; OpenAlex and any future provider tiers must be confirmed. |
| Database and storage | Actual Supabase plan, compute size, database/storage bytes, egress, backup retention and overages; no active billing data was available here. |
| Hosting | Actual Vercel team plan, seats, function execution, bandwidth, analytics and overage. Public pricing is only a reference. |
| Email | Provider plan, transactional volume and overages; no verified EYLO provider or invoice. |
| Payment processing | `successful transactions × (regional percentage fee × amount + fixed fee)` plus applicable currency conversion, tax and dispute costs. Country, card mix and negotiated rates are unknown. |
| Support | `tickets per active user × minutes per ticket ÷ 60 × loaded support hourly cost`; no volume or labor rate is measured. |

High-risk usage: long evidence bundles passed repeatedly to a premium model, unbounded document regeneration, retries after ambiguous completion, automated background tasks, and retrieval fan-out when several upstream services are slow. Before enabling wider access, set server-side per-account/day and per-operation quotas, hard monthly provider budgets, bounded prompts/outputs, safe idempotency, alerts at 50/75/90% of budget, and graceful exhaustion messages. Existing source code contains quota mechanisms; their current hosted configuration and effective spend caps still need acceptance.

## Product, operations, legal and pilot work

- **Competitive fit:** Existing [market audit](../EYLO_COMPANY_READINESS_2026-11-21.md) maps Elicit, Consensus, Scite, ResearchRabbit, Connected Papers, Zotero, SciSpace and Overleaf. EYLO's differentiator should be a source-linked path from discovery to an editable research/project proposal. The launch-blocking gap is evidence that this path works durably, privately and credibly with actual researchers. Do not claim feature parity or superiority; validate the current comparison against competitors' official documentation before external claims.
- **Onboarding and help:** User-type onboarding and research workflow explanations exist in source, but no measured friction study, delivered support channel, staffed response commitment or account/billing assistance workflow is verified. Pilot minimum: first project, one guided search, save one real record, run one cited EYRA task, export, report a bug, and receive a tested support reply.
- **Observability:** API health/status and operational endpoints exist in source; no verified centralized exception dashboard, alert delivery, uptime SLO, payment-failure alert or private-content-safe production log review is recorded. Verify dashboards/alerts and remove content, tokens, email and credentials from logs.
- **Recovery:** Supabase's published plan retention is not evidence that EYLO backups exist or can be restored. Run a point-in-time backup and restore in an isolated project, rehearse migration rollback/forward recovery, verify export restoration limits, and record owner, RPO/RTO, timestamps and hashes. Current recovery readiness is unproven.
- **Legal drafts:** A review scaffold for Terms, Privacy, Cookie, Acceptable Use, Subscription, Cancellation/Refund, IP, Research Integrity, Retention and Subprocessor disclosures is now in [EYLO_POLICY_DRAFTS_FOR_COUNSEL.md](../legal/EYLO_POLICY_DRAFTS_FOR_COUNSEL.md). It contains owner/counsel placeholders and is explicitly unpublished and incomplete. Controller/contact, jurisdiction, actual processors, retention/deletion, IP/licensing and refund decisions remain unresolved; no legal approval is claimed.
- **Scientific evaluation:** Use the existing [scientific evaluation runbook](../scientific-evaluation-runbook.md) and [pilot protocol](../RESEARCH_VALIDATION_AND_PILOT.md). They require real references, independent reviewers and explicitly distinguish citation identity from claim support. No human scores, endorsements or validity claims are available.
- **Pilot process:** Do not invite anyone from this change. A future closed pilot needs opt-in consent, a named support owner, synthetic or consented research content, a bug channel, incident escalation, an evaluation questionnaire and published stop criteria. Pilot success should require no critical privacy/security defects, successful end-to-end task completion, reliable project restoration and independently reviewed source/claim quality.

## Exact owner actions to reach the next mode

1. Current state: the connected organization is on Free and already has two projects. The $0 `eylo-staging` create was rejected at the Free two-project cap; the owner chose to remain on Free. Production and `job` are not staging targets. To proceed, the organization billing owner must approve Pro in Supabase Dashboard → Organization → Billing and verify the final estimate, then create a separate EU staging project. Published baseline is Pro $25/month plus an additional project from $10/month (about $35/month before usage, add-ons and overages); do not buy without the owner's approval. Configure Vercel Dashboard → `eyloai` → Settings → Environment Variables with Preview-only, branch-scoped staging `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SECRET_KEY`. The current preview branch has zero Preview variables. Configure staging Auth SMTP and two disposable inboxes; do not reuse `job`.
2. Reconcile staging migration history; rehearse the pending correction in disposable PostgreSQL and approved staging only. Provide backup and rollback evidence before any staged schema write.
3. Complete hosted two-account Auth, project/paper persistence, Storage, EYRA and export/reload acceptance; prove account B cannot read, update or delete account A's data.
4. Resolve the leaked-password Auth gate with the Supabase owner. The connected org is Free and Supabase rejected staging creation at its two-project cap. Leaked-password protection requires Pro. Billing owner must separately approve upgrade (Pro starts at $25/month; dedicated additional project starts at $10/month, about $35/month before overages), then enable Auth → Settings → Password security and rerun the Security Advisor. Do not upgrade without explicit approval.
5. Verify provider model SKU, aggregate cost telemetry, quotas and hard spend caps; run real-provider acceptance only with an approved cap.
6. Run the frozen multi-discipline retrieval and claim-level scientific evaluation with independent researchers; record actual ratings and disagreements.
7. Verify Stripe entirely in test mode or keep it disabled. Do not choose prices or alter live billing from this report.
8. Have qualified counsel and the owner review the legal decisions above; verify support, monitoring, incident response and isolated restore.
9. Freeze one candidate SHA, pass every exact-head CI and hosted gate, and obtain explicit release-owner approval before any merge, promotion or production migration.

## Scope and exclusions

This report does not authorize production migration, deployment, account creation/deletion, live provider spend, billing configuration, customer contact, infrastructure purchase or claims of legal/scientific approval. The change records readiness evidence and next checks only.
