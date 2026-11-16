# EYRA 2030 — evidence, consent and research-quality gate

## This change delivers

- The compact EYRA chat stays compact. Retrieved source links are labeled as **retrieved records**, not proof of the surrounding scientific claim.
- Publication links are explicitly marked as bibliographic/abstract records, not confirmed full-text reads, appraisal or claim-level verification. Funding links require independent verification of official deadlines and eligibility; profiles require confirmation of affiliation.
- Citation chips accept only bounded IDs and safe HTTP(S) URLs. The presentation deduplicates references and does not turn unsafe model/source URLs into clickable links.
- A search that retrieved or attempted academic evidence but resulted in zero cited records now carries a visible, accessible warning. The flag persists through conversation normalization without adding user/private source data.
- A user's `data_personalization=false` preference also prevents automatically forwarding an active-project resource identifier to the EYRA API. The backend owner-scope/RLS enforcement remains mandatory even when personalization is enabled.
- Regression tests cover the limits, unsafe URLs, missing citations, persisted warning and contextual privacy boundary.

## Other EYRA 2030 work already present or tracked elsewhere

- **Context:** `/api/eyra` supports bounded server-retrieved owner-checked project, note and paper resource context (not browser-supplied trusted text). This change strengthens the preference opt-out, not the server's scope checks.
- **Write safety:** separate user-request review and latest-turn write confirmation already exist. **Field-level exact pending write previews are not yet provided**; avoid claiming that a model-generated write has been previewed before execution.
- **Durable retries:** draft PR #475 implements an owner-scoped tool-action ledger and retry boundaries. Do not duplicate or merge this work without reviewing its migration and cross-user CI.
- **Review workflows:** human screening, protocol and editable evidence outline already exist. An outline does not imply full-text extraction or systematic-review completion.
- **Quality metrics:** test coverage verifies citation IDs and metadata scope, not scientific truth. Human reviewers must evaluate claim-level support against actual source texts.

## Acceptance before merge or deployment

1. All required CI checks passing **for the PR head SHA**, including unit tests, typecheck, lint, build and database authorization checks.
2. Authenticated browser smoke for linked evidence labels, no-citation warnings, preferences-off request payload and compact responsive layout.
3. Live two-user authorization, citation-quality audit on independently reviewed sample questions, failure-mode review and preview deployment at exact SHA.
4. Merge only after reviewers verify interplay with the PR #475 action-ledger migration and the changing `main` baseline.

### Suggested measurable research-quality acceptance criteria

Measure in a blinded, reviewer-audited corpus of at least 50 real questions across methods, evidence comparison, funding and literature review: `citation_identifier_precision`, `claim_supported_by_source_rate`, `no_evidence_disclosure_rate`, `cross_account_data_leak_count`, `write_without_confirmation_count`, and `duplicate_write_on_retry_count`. Record denominators and confidence intervals; never infer scientific accuracy from source-link validity alone. Zero cross-account leaks and zero unauthorized writes are release-blocking targets, not established measurements.
