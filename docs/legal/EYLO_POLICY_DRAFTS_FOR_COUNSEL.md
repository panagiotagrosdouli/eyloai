# EYLO legal policy drafts — counsel review required

**Status: DRAFT, INCOMPLETE, NOT APPROVED, NOT FOR PUBLICATION.** This packet is a working draft for qualified counsel and the service owner. It is not legal advice and does not establish that any policy is complete, enforceable or compliant. Replace every bracketed decision only after confirming actual service behavior and the applicable jurisdiction.

## Owner decisions required before publication

- Legal entity and registered address: **[OWNER INPUT]**
- Service controller / operator identity and privacy contact: **[OWNER INPUT]**
- Governing law, courts and consumer jurisdictions: **[COUNSEL + OWNER INPUT]**
- Service launch mode, age eligibility and geographic availability: **[OWNER INPUT]**
- Free and paid plan names, prices, taxes, renewal period and included usage: **[OWNER APPROVAL; BILLING CURRENTLY DISABLED]**
- Cancellation, refund, trial, grace-period and failed-payment treatment: **[COUNSEL + OWNER INPUT]**
- Data retention by category and backup-expiry window: **[COUNSEL + OWNER INPUT]**
- Actual subprocessors, processing regions, transfer safeguards and vendor terms: **[VERIFY AGAINST DEPLOYED CONFIGURATION]**
- Copyright / database rights allocation for uploaded materials and generated outputs: **[COUNSEL + OWNER INPUT]**
- Support address, response expectations and security incident contact: **[OWNER INPUT; DELIVERY NOT VERIFIED]**
- Cookie/local-storage inventory and consent requirements: **[TECHNICAL INVENTORY + COUNSEL REVIEW]**

The source [privacy data-flow notes](../PRIVACY_DATA_FLOW.md) describe engineering intent, not proof of deployed processing. Reconcile these drafts against the exact release candidate and vendor contracts. Do not publish while a required field remains unresolved.

## 1. Terms of Service — working draft

**Provider.** EYLO is provided by **[LEGAL ENTITY AND CONTACT]** (“EYLO”, “we”, “us”). These terms govern access to **[SERVICE URL / INCLUDED PRODUCTS]** by **[ELIGIBILITY / AGE / TERRITORY]** users.

**Accounts.** Users must provide accurate registration information, protect their sign-in credentials, and promptly report suspected account compromise to **[SUPPORT CONTACT]**. Account sharing, identity requirements and organizational accounts are subject to **[OWNER / COUNSEL DECISION]**.

**Research assistance.** EYLO provides organizational, discovery and AI-assisted drafting tools. AI-generated text may be incomplete or incorrect. Users must inspect original sources, citations, research methods, funding-call requirements, ethics requirements and institutional rules before relying on or submitting output. EYLO does not certify scientific validity, novelty, eligibility, authorship, ethics approval, publication acceptance or funding outcomes.

**User materials.** Users are responsible for having the rights and permissions required to upload, process, share or export submitted materials. The limited service license, generated-output treatment, third-party content restrictions and any institution/employer rights must be specified by counsel: **[IP TERMS REQUIRED]**.

**Third-party services.** Discovery, hosting, authentication, AI, payment and email services may be provided by independent providers. Identify the actual providers and applicable terms at **[LINKS / SUBPROCESSOR PAGE]**. Features may become unavailable when an upstream provider is unavailable.

**Acceptable use, suspension and termination.** Reference the approved Acceptable Use Policy. Suspension, account closure, data export, deletion and any appeal procedure require **[OWNER / COUNSEL DECISION]** and must match actual technical behavior.

**Plans, liability, dispute terms and changes.** Paid plans are unavailable until separately enabled and priced by the owner. Add locally valid tax, renewal, cancellation, refund, warranty, liability, dispute-resolution, governing-law and change-notice wording only after counsel review: **[COUNSEL DRAFT REQUIRED]**.

## 2. Privacy Policy — working draft

**Controller and contact.** The controller is **[ENTITY, ADDRESS, PRIVACY EMAIL]**. Data protection officer or representative, if required: **[COUNSEL / OWNER INPUT]**.

**Information and purposes.** The technical design can process account identifiers; authenticated workspace records such as projects, ideas, papers, researchers, opportunities, meetings, search history and watchlists; prompts and selected research/project context sent to EYRA; service/security logs; analytics events; and billing identifiers if billing is enabled. Confirm each category, its purpose, collection point and deployed status from the release candidate before retaining this text. Public discovery queries may be sent to scholarly metadata providers and are not private-workspace data under the current engineering description.

| Data category | Purpose | Legal basis | Retention | Required owner/counsel decision |
|---|---|---|---|---|
| Account and authentication data | Account creation, sign-in, recovery, security | **[COUNSEL INPUT]** | **[SET PERIOD]** | Verify identity provider and logs |
| Research workspace content | Save, retrieve, export and delete user work | **[COUNSEL INPUT]** | **[SET PERIOD / BACKUP EXPIRY]** | Confirm tables, files and deletion behavior |
| EYRA prompt and selected context | Provide requested AI response | **[COUNSEL INPUT]** | **[SET PERIOD; CHECK PROVIDER TERMS]** | Confirm provider, model, region, training/retention settings |
| Public search query and provider response metadata | Perform literature discovery and service diagnostics | **[COUNSEL INPUT]** | **[SET PERIOD]** | Check proxy logs and upstream terms |
| Security / operational logs | Prevent abuse, debug and protect availability | **[COUNSEL INPUT]** | **[SET PERIOD]** | Verify that content and credentials are excluded |
| Product analytics | Measure coarse feature adoption and failures | **[COUNSEL INPUT]** | **[SET PERIOD]** | Confirm events contain no research free text |
| Billing identifiers (only if enabled) | Payment, entitlement and financial records | **[COUNSEL INPUT]** | **[LEGAL / TAX PERIOD]** | Verify Stripe mode, records and invoice duties |

**Recipients and transfers.** Publish a verified subprocessor list with service, processing purpose, region and transfer mechanism. Do not infer production vendors solely from dependencies or environment variable names. Current engineering notes mention Supabase, OpenAI, Stripe, Resend and scholarly providers; actual enabled vendors remain **[VERIFY]**.

**Rights and choices.** Describe access, correction, objection, restriction, portability, deletion and complaint rights applicable to each jurisdiction; identify how requests are authenticated and where they are submitted: **[COUNSEL / OWNER INPUT]**. Describe any legal limitations and response timelines only after review.

**Security, children, automated decisions and changes.** Describe measured technical safeguards without promising absolute security. State age restrictions and whether children’s data is processed: **[OWNER / COUNSEL INPUT]**. Clarify that AI output is assistive and not used to make decisions with legal or similarly significant effects, if true: **[VERIFY]**. State effective date and notice method: **[INPUT]**.

## 3. Cookie and local-storage notice — working draft

The site may use strictly necessary browser storage for authentication, routing, accessibility preferences and security. Any analytics, advertising or nonessential storage must be inventoried by name, provider, purpose, duration and jurisdiction before use. No nonessential cookie/storage should be described as active or set before the applicable consent choice is recorded. Publish the following only after technical verification:

| Key / cookie | Provider | Purpose | Duration | Essential? | Consent control |
|---|---|---|---|---|---|
| **[INVENTORY REQUIRED]** | **[VERIFY]** | **[VERIFY]** | **[VERIFY]** | **[COUNSEL]** | **[IMPLEMENT / TEST]** |

Contact for cookie choices: **[OWNER INPUT]**. Applicable consent, withdrawal and “do not track” language: **[COUNSEL INPUT]**.

## 4. Acceptable Use Policy — working draft

Users may not use EYLO to violate law or third-party rights; upload materials without required authority; attempt to access another user’s workspace; attack or disrupt the service; bypass usage controls; submit malicious prompts or files intended to compromise users or providers; or misrepresent AI-generated material, citations, funding eligibility or research approvals as independently verified.

Users remain responsible for original-source review, human authorship decisions, research integrity, disclosure obligations, human-subjects/ethics approval, institutional policies, and any funder or publisher rules. The owner and counsel must define enforcement, reporting, suspension and appeal details: **[INPUT]**.

## 5. Subscription terms — draft, currently inactive

**Paid subscriptions are not offered by this draft.** Production billing is currently reported disabled; no price, entitlement or paid benefit is represented here. If the owner later authorizes Stripe test-mode validation and then separately approves live pricing, fill in:

- Available plans, prices, currency, tax handling and billing interval: **[OWNER APPROVAL]**.
- Included AI/search/storage usage and over-limit behavior: **[OWNER + PRODUCT]**.
- Trial duration, renewal notice and changes to price: **[COUNSEL + OWNER]**.
- Payment processor, receipt/invoice requirements and failed-payment grace/suspension: **[VERIFY]**.
- How server-verified entitlements start, renew, expire and are revoked: **[VERIFY WITH IMPLEMENTATION]**.

Do not publish “Premium” entitlements or checkout calls to action until all entries are approved, test lifecycle checks pass, and the production payment switch is separately authorized.

## 6. Cancellation and refund terms — working draft

Users may cancel through **[VERIFIED ACCOUNT/BILLING ROUTE]** or contact **[SUPPORT CONTACT]**. State the effective cancellation date, whether access continues through the paid period, renewal cutoff, refund/withdrawal rights, statutory consumer exceptions, taxes and payment-dispute handling only after country-specific counsel review. No refund promise, limitation or waiver is approved in this packet. Current billing is disabled; this section must remain unpublished until a paid plan is approved and the route is tested.

## 7. Intellectual Property Policy — working draft

Users retain whatever rights they hold in their submitted materials, subject to third-party and institutional rights. The exact, limited license required to host, transform, transmit and return user materials is **[COUNSEL TO DEFINE]**. Ownership and permitted use of AI outputs, EYLO software/marks, scholarly metadata, publisher full text, uploaded call documents and collaborative contributions must be defined separately. This policy must not promise that output is unique, copyrightable, noninfringing or eligible for publication. Report notices to **[RIGHTS CONTACT / PROCESS]** after counsel approves the procedure.

## 8. Research Integrity and AI Use Notice — working draft

EYRA produces AI-assisted analysis and drafting, not expert peer review or established consensus. Citations may be incorrect, incomplete or only metadata-matched; a citation is not proof that the cited source supports a claim. Users must open and inspect original sources, check corrections/retractions, validate methods and calculations, verify official funding instructions, obtain required approvals, disclose AI assistance where required, and make final authorship/submission decisions. Generated funding eligibility, milestones, budget and deadline statements must be checked against the current official call. Do not describe EYLO as validated, endorsed, accurate or compliant without independent evidence supporting the specific claim.

## 9. Data Retention and Deletion Policy — working draft

The service must state a verified retention period, deletion trigger and backup-expiry behavior for every data category in the Privacy Policy table. Users can request an export or deletion at **[VERIFIED SETTINGS/CONTACT]**. Explain reauthentication, deletion scope, processing time, backup/log exceptions, legal holds, third-party provider deletion and account closure effects only after testing the exact deployed process. The technical export has documented scope exclusions; describe those plainly and do not promise a full backup restore or complete deletion before operational verification.

| Record class | Retention period | Deletion event | Backup / downstream expiry | Verified? |
|---|---|---|---|---|
| Workspace rows and uploaded file bytes | **[OWNER / COUNSEL]** | **[VERIFY]** | **[VERIFY BACKUP TTL]** | NO |
| Auth and recovery records | **[OWNER / COUNSEL]** | **[VERIFY]** | **[VERIFY PROVIDER]** | NO |
| EYRA and provider logs | **[OWNER / COUNSEL]** | **[VERIFY]** | **[VERIFY PROVIDER]** | NO |
| Security, usage and analytics events | **[OWNER / COUNSEL]** | **[VERIFY]** | **[VERIFY]** | NO |
| Billing and tax records, if enabled | **[COUNSEL / TAX]** | **[VERIFY]** | **[VERIFY PROCESSOR]** | NO |

## 10. Subprocessor Disclosure — draft, inventory not verified

Before publication, reconcile deployed environment settings, hosting configuration, data flows, contracts and vendor subprocessors. This table is intentionally a verification worksheet, not a claim that each provider is currently enabled.

| Provider / subprocessor | Service | Data categories | Processing region | Contract / transfer safeguard | Enabled in candidate? |
|---|---|---|---|---|---|
| Supabase | Database/auth/storage | Account and workspace data | **[VERIFY]** | **[VERIFY]** | **[VERIFY]** |
| OpenAI | AI inference | Prompt and selected context | **[VERIFY MODEL/REGION/RETENTION]** | **[VERIFY]** | **[VERIFY]** |
| Vercel | Hosting/server functions | Request metadata and application data | **[VERIFY]** | **[VERIFY]** | **[VERIFY]** |
| Stripe | Payments, only if enabled | Customer and transaction identifiers | **[VERIFY]** | **[VERIFY]** | **[CURRENTLY REPORTED DISABLED]** |
| Resend | Transactional email, only if enabled | Recipient address and message metadata | **[VERIFY]** | **[VERIFY]** | **[CURRENTLY REPORTED DISABLED]** |
| Scholarly metadata providers | Public literature search | Search queries and returned public metadata | **[VERIFY PER PROVIDER]** | **[TERMS REVIEW REQUIRED]** | **[VERIFY]** |

Update frequency, notice for provider changes and a privacy contact: **[COUNSEL / OWNER INPUT]**.

## Review and release checklist

- [ ] The owner filled all identity, jurisdiction, product, contact and retention decisions.
- [ ] Counsel reviewed consumer, privacy, cookie, subscription, cancellation/refund, IP and transfer language for target markets.
- [ ] Technical owner reconciled every statement against the exact deployed candidate and actual vendors.
- [ ] Security owner verified account access, export/deletion, logs, backups and incident contact.
- [ ] Product owner verified free/paid entitlements, usage limits, checkout and cancellation behavior; payments remain disabled until approved.
- [ ] Effective dates, revision history, consent behavior and support paths are implemented and tested.
- [ ] Required translations and plain-language review are complete.
- [ ] Named counsel and owner approvals are recorded outside this draft.
