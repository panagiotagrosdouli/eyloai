# EYLO company readiness | 21 November 2026

## A. Company readiness

**Positioning.** EYLO — From Evidence to Action. EYLO helps researchers find scholarly records, inspect original sources and carry selected evidence into a research workspace. EYRA is the research assistant. The commercial hypothesis is that teams will pay to save time and preserve traceability from a paper to a project decision.

| Area | Assessment | Evidence and next verification |
|---|---|---|
| Public discovery | Working but needs improvement | Prior live OpenAlex result and working DOI in the [technical audit](EYLO_NEXT_GENERATION_AUDIT_2026-11-21.md). Measure current multi-provider availability, relevance and source links across disciplines. |
| Onboarding and public information | Working but needs improvement | `GettingStarted.jsx`, `CompanyPage.jsx`, `Pricing.jsx`. Existing goal-based onboarding and 15 company answers. Audit prices and capabilities against the deployed state before promotion. |
| Workflow persistence and exports | Unverified for this launch | Library, projects, notes and files have application paths and fixture evidence. Verify create, save, reload, export and deletion with disposable hosted data. |
| EYRA | Release-blocking for advertised AI | `api/eyra.js`, `api/eyra-approve.js`, and `server/eyra-run-ledger.mjs`. Public AI flag is true. Live completion, evidence support, write confirmation, persistence and audit history need hosted acceptance. |
| Auth and data isolation | Release-blocking for external pilots | Auth and owner-scoped RLS exist in source. Follow [two-account checklist](TWO_ACCOUNT_RLS_ACCEPTANCE.md) for projects, Library, EYRA and files. Verify recovery, revocation and account switching. |
| Contact and support | Release-blocking for customer intake | `server/contact.js` integrates Resend. Public contact flag is false. A supplied and approved support channel, receipt, triage and deletion process are required. An availability flag alone cannot show inbox delivery. |
| Billing | Incomplete for sales | Public billing false. No subscription transaction, entitlement or refund was exercised. |
| Hosting and change control | Release-blocking | Main after PR #586 is `766d518512d5984f9f67a674b69dfcc3b4ba7fe7`. Public deployment status still reports `bd9e97232142e2704757200ec31d90bcbd4c990f`. The prior audit recorded failed Supabase Preview. |
| Operations and legal | Incomplete | Repository has [privacy data flow](PRIVACY_DATA_FLOW.md), [account deletion plan](ACCOUNT_DELETION_IMPLEMENTATION_PLAN.md) and [launch gate](LAUNCH_READINESS_GATE.md). Confirm controller, effective notices, backups and restore, monitoring, incident ownership and signed processor terms. |
| Customers and expenses | Unverified | No invoice, provider usage export, CRM, signed pilot, paid conversion or cohort data was reviewed. Public route checks and internal test runs cannot establish demand or unit economics. |

Read-only public evidence: [deployment status](https://eyloai.vercel.app/api/deployment-status) and [capability flags](https://eyloai.vercel.app/api/capabilities). Current source evidence and observed production behavior are dated and can diverge.

## B. Competitive positioning

| Product | Publicly documented focus | Comparable EYLO test |
|---|---|---|
| [ChatGPT Deep Research](https://openai.com/index/introducing-deep-research/) | Multi-step research and cited reports | Time to a reviewed claim and saved next action. |
| [Elicit](https://elicit.com/) | Literature screening and structured extraction | Screening decisions, claim provenance and review export completeness. |
| [Consensus](https://consensus.app/home/) | Scholarly search and research-linked answers | Retrieval precision, citation validity and source coverage. |
| [Scite](https://scite.ai/) | Supporting and contrasting citation statements | Accuracy of excerpt-level support and contradiction labels. |
| [NotebookLM](https://notebooklm.google/) | Analysis and writing grounded in a chosen collection | Source traceability and continuity after saving and reloading. |
| [Zotero](https://www.zotero.org/support/) | Reference capture, organization and bibliography workflows | Citation fidelity, organization and usable export. |

Test one shared set of search, compare, verify, save and export tasks with reviewed ground truth, date, tier, coverage and product/version recorded. Blind-grade citation validity and source-to-claim correctness. Track completion, minutes, errors, subscriptions and marginal cost per completed task. Public capability descriptions are scope evidence. Controlled comparisons and current price quotes remain outstanding.

## C. Ranked roadmap and 90-day milestones

| Window | Priority and owner | Value, effort and exit evidence |
|---|---|---|
| Days 1–30 | P0 Engineering and founder | High impact, medium-to-high effort. Resolve deployment identity and staging preview. Verify auth, support and one discovery → save → reopen workflow. Gather invoices and recruit interviews with consent. |
| Days 31–60 | P1 Product and engineering | High impact, high effort. Pilot the highest-frequency task, check evidence support and exports, measure activation, and complete provider, permission and backup acceptance. |
| Days 61–90 | P1 Founder, finance and counsel | High impact, external dependencies. Review quotes and willingness to pay, confirm terms and operating duties, complete launch gates. Prepare a billing decision after legal and security review. |

Within engineering, prioritize public search/source links and private workspace persistence ahead of new synthesis features. Next verify explicitly confirmed EYRA writes and traceable exports. Defer institution-facing administration and commercial plan activation until buyer evidence and acceptance exist.

## D. Business model hypotheses

| Segment | Candidate pain | Initial route and buying uncertainty |
|---|---|---|
| Master's students | One-off screening or coursework | Supervisor or research-methods group. Episodic use and limited budget. |
| PhD students | Recurring screening and paper organization | Doctoral communities and supervisors. Test individual and lab-funded purchases. |
| Postdocs | Literature updates and defensible project decisions | Lab and peer referrals. Test repeat use between manuscripts and grants. |
| Academics | Supervision, evidence review and grants | PI referrals. Test time saved and delegation fit. |
| Labs and small research groups | Provenance and team handoff | PI and lab manager. Test budget owner, private projects and export requirements. |
| Departments | Procurement, administration and training | Innovation or library program. Validate longer procurement and accessibility needs. |
| R&D teams | Literature-to-experiment decisions | R&D lead. Validate confidentiality and a repeatable use case. |
| Startups and innovation businesses | Technical due diligence and evidence briefs | Founder and innovation programs. Validate repeat frequency and support cost. |

First recruiting cohort hypothesis: small academic groups with a PhD or postdoctoral champion and an identifiable PI buyer, working on a recurring literature-to-project task. This is a sampling decision. Select the actual ICP after interviews, completed tasks, repeat use and concrete budget signals.

Free exploration, Researcher Pro, Research Teams and Institutional are testable packaging hypotheses. Test value from repeat reviews, shared evidence handoffs, exports and accountable administration before setting prices. Acquisition starts with research communities and referrals. Activation is useful source → original record → saved project decision. Retention is reopening the same work and completing a second task within seven days. Track support and provider cost per completed workflow before expanding paid usage.

## E. Greek and international legal and operational checklist

- Founder and Greek counsel/accountant compare ΙΚΕ, other forms and sole trading for liability, governance, formation, tax and payroll. Confirm entity registration route, GEMI obligations, KAD activity codes, VAT, invoices/myDATA, accounting and cross-border sales treatment. [Greece e-ΥΜΣ](https://eyms.businessportal.gr/) · [AADE](https://www.aade.gr/)
- Prepare an inventory of repo, design, domains, provider accounts, licenses and third-party data. Counsel verifies founder/contractor IP assignments and founder agreement. Check EYLO’s name in relevant registries and markets before any filing or purchase. [EUIPO trademark search](https://www.euipo.europa.eu/en/trade-marks/before-applying/availability)
- Prepare a data map, controller and processor roles, purposes/legal bases, retention, data-subject requests, backups, deletion and incident handling. Counsel reviews privacy notice, DPAs, subprocessors, international transfer safeguards, DPIA need and research data restrictions by market. [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- Review scholarly API licenses, attribution and caching, model provider data handling and AI disclosures. Counsel assesses EU AI Act classification and applicable dates, terms, digital service rights, cancellation, refunds and consumer pricing disclosures. [EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) · [EU consumer rights directive](https://eur-lex.europa.eu/eli/dir/2011/83/oj)
- Engineering prepares evidence and runbooks. Founder assigns support, backup/restore, on-call and security incident ownership. Counsel and accountant review legal and financial obligations. The owner authorizes formal filings, purchases, contracts and payment activation separately.

## F. Twelve-month financial model

Run `node scripts/model-company-finances.mjs > forecast.csv` from the repository. Edit [assumptions](company-financial-assumptions.json) or pass a replacement JSON file path. The [forecast CSV](company-financial-forecast.csv) contains 84 monthly rows across no revenue, early paid, moderate growth, higher AI cost, higher provider cost, team hiring and infrastructure scaling.

Illustrative EUR inputs only. The model starts from zero paid users and treats signups, churn, costs and collections as monthly expected values. Net price excludes VAT. The model assumes same-month cash collection, no financing and no tax, refunds or deferred revenue. It records the first month with negative cash within the 12-month window. Blank margin means zero revenue. Blank break-even means nonpositive unit contribution. Static break-even assumes fixed charges, and CAC is acquisition spend divided by expected new paid accounts.

Before using the model for decisions, replace opening cash with verified cash, AI unit cost with measured token/call usage and actual invoices, hosting/database/storage and API charges with contracted costs, and fees with actual processor terms. Record fully loaded support and staffing costs, VAT/tax treatment, refunds and collection timing. The illustrative early-paid case ends with about €7,071 in cash. The hiring scenario crosses zero in month 9. Both are outputs of assumptions, with profitability and market demand still unknown.

## G. Customer validation and GTM kit

**Targets.** Interview 20 prospects across candidate roles, observe 10 realistic tasks and ask five qualified buyers to evaluate specific paid terms. These are planning targets. Recruitment, interviews and purchases remain unexecuted.

**Draft outreach.** “I’m inviting researchers who regularly review papers to a 30-minute conversation about how they turn source evidence into project decisions. If you’re interested, we can also test an EYLO workflow using a public research question. Participation is voluntary.”

**Interview.** Ask the participant to reconstruct their last review, show the handoffs they can share, identify a rework example, estimate time from real artifacts, describe current spend, and name who approves a purchase. Then test a concrete offer and ask what would have to happen to approve it.

**Demo and pilot.** Use a public topic, try search, open a DOI and verify the record, save a selected source using a test workspace, reload, add a decision and export if those paths have passed staging. Start with a two-week pilot on public or approved data, one workflow, scheduled check-ins, an explicit support channel and a participant exit and deletion process. Offer a reviewable scope, duration, data terms and success criteria for authorized buyers. Institutional discussion outline: workflow problem → live evidence → ownership and privacy → pilot scope → procurement and next decision.

**Measurement.** Activation is a qualifying first-task completion within five minutes divided by starters. Record time from task start to useful result, completion rate by task, weekly active participants, seven-day return, feature adoption, errors per attempted workflow and post-task satisfaction. Record who sets the budget, commitment to concrete terms and conversion separately. Obtain consent before recording, use participant IDs, restrict access and set a deletion date. Collect account and work data only as needed and avoid sensitive research materials.

## H. First implementation

The existing public `/start` guide links directly to pricing availability and contact. It uses the current routes and contact availability behavior. The browser acceptance covers both links at the mobile viewport. Finance assumptions, the CSV generator and a calculation regression are included in the same draft for review.

## I. Launch decision

**NO-GO for commercial launch and private external pilots today.** Require current deployment provenance, secure hosted auth and two-account persistence, a verified support channel, restoration and deletion evidence, accessible completion of the core research task, accurate public claims and approved data handling. A paid launch additionally requires concrete procurement signals, verified costs, legal terms, and explicitly approved payment, webhook, entitlement, cancellation and refund acceptance. Internal public-data testing and consented discovery interviews can proceed through approved channels.
