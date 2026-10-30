# EYLO — Company operating plan and release gates

Owner: founder / authorized company representative. Status: **NOT READY FOR COMMERCIAL LAUNCH**.
Last checked: 2026-10-30. This is an execution plan, not evidence of company incorporation, customer adoption, completed compliance, or verified billing.

## Positioning and market
EYLO is an AI-assisted scientific research workspace. Launch with one validated core journey and three *sales segments* (not three separate implementations):
- **Individual**: free trial/free tier and paid individual research productivity; validate willingness to pay.
- **Academic**: labs, research groups and universities; discovery sessions, pilots and procurement requirements.
- **Enterprise**: R&D teams; private workspace, governance, data processing agreements and institutional procurement.

Do **not** claim institutional partnerships, certifications or customer results until evidenced.

## Operating responsibilities

| Function | Accountabilities | Metrics |
|---|---|---|
| CEO / product | Market positioning, discovery interviews, roadmap, company incorporation and go/no-go decisions | Activation, retention, paid conversion |
| CTO / security | Build/deploy, Supabase identity and RLS, scientific retrieval quality, EYRA, observability, backups | E2E pass rate, error rate, incidents, source integrity |
| CBO / sales | Pricing interviews, individual funnel, academic pilots, enterprise pipeline, support workflows | Qualified leads, pilot-to-paid, MRR, churn |
| Finance/legal (qualified professionals) | Company formation, VAT/tax, invoicing, terms, GDPR roles, AI Act applicability, IP/trademark checks | Signed-off legal checklist, reconciled revenue |

## Verified snapshot

- GitHub `main` React/Vite app; Vercel production deployment on Hobby plan (verify commercial-usage eligibility before selling).
- On 2026-10-30, Vercel listed `OPENAI_MODEL`, `OPENAI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for preview and production; presence does not verify validity or runtime functionality.
- No Stripe or server-side Supabase credential *names* appeared in that environment listing. Do not activate billing until configured and verified privately.
- Main build/quality checks were previously green. Passing CI is not a customer-journey acceptance test.
- Follow existing `docs/LAUNCH_READINESS_GATE.md`: it is authoritative for production acceptance.

## Execution order and exit criteria

### P0 — Platform integrity (CTO)
1. Keep dependency update batches React-18-compatible; investigate incompatible Dependabot PR #103 before merging.
2. Validate Vercel production and preview match expected GitHub commits; review commercial hosting rights and upgrade if needed.
3. Add full browser E2E for register -> login -> discover -> save -> project -> EYRA -> logout with dedicated test users.
4. Validate database project identity, backups, row-level security using two disposable accounts, deletion, resets and OAuth.
5. Probe scientific APIs with biomedical, computing, environment and social-science topics; verify links, DOIs, duplicate removal, freshness and upstream outage handling.
6. Check EYRA refuses fabricated citations, distinguishes inference from evidence and uses server-only API keys.
**Exit:** tests and live evidence recorded for all scenarios; zero critical blockers.

### P1 — Paid product (CTO + finance)
1. Define and test plan entitlements on the server, not only in the browser; no unsupported feature promises.
2. Configure Stripe keys, prices, signed webhooks and billing portal with account owner in secret stores, never in GitHub.
3. Test sandbox checkout, failed/duplicate webhook, refund/cancel, renewal, expired subscription, trials and limits.
4. Confirm invoices, VAT treatment, merchant identity, refund terms and financial reconciliation with accountant.
**Exit:** independent sign-off on checkout/webhook/entitlement matrix; production billing enabled only after verification.

### P2 — Company compliance and trust (CEO + qualified counsel)
1. Choose jurisdiction, entity structure, beneficial owner, accounting and banking; do not assume an entity exists.
2. Verify trademark/domain/IP availability and rights to logos, code and content.
3. Obtain legally reviewed terms, privacy/cookies, retention/deletion processes, subprocessor list and data-processing agreements.
4. Evaluate GDPR controller/processor roles, international transfers and AI Act obligations for actual features/use cases.
5. Publish support channel and incident/complaint handling, backup restore and continuity procedures.
**Exit:** counsel/accountant approval, support readiness and signed release register.

### P3 — Go-to-market (CEO + CBO)
1. Conduct interviews with 10 individuals, 5 academic labs and 5 R&D organizations; record pains and objections.
2. Pilot one validated research workflow with consented testers. Track activation (first source-backed result saved).
3. Propose pricing only after verified unit costs and customer willingness-to-pay; avoid invented market traction.
4. Publish honest positioning, demo, help center, contact channel and onboarding flow.
5. Release by cohort: internal -> invited pilot -> paid individual -> academic -> enterprise.
**Exit:** customer support coverage, launch KPIs, evidence of value and explicit owner go/no-go.

## Weekly scorecard (fill with actual data, do not fabricate)

| Metric | Baseline | Target | Source |
|---|---|---|---|
| Public uptime | TBD | Set after monitoring setup | Vercel logs |
| E2E core journey pass | TBD | 100% critical paths | Test runner |
| Cross-account RLS | TBD | 0 unauthorized access | Supabase acceptance report |
| Valid citations in audited EYRA responses | TBD | 100% traced to retrieved sources | Human review |
| Activated pilot users | TBD | Set after interviews | Consent-aware analytics |
| Paid MRR / churn | TBD | Set after billing verification | Stripe reports |

## Release ownership

No one may mark production launch GO based only on this document or green CI. Record tested deployment SHA, test artifacts, data protection review, pricing/billing verification and sign-off in `docs/LAUNCH_READINESS_GATE.md`. Do not place credentials, personal data or customer secrets in evidence.
