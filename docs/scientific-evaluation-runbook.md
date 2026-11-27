# EYLO scientific evaluation — reproducible offline acceptance packet

**Status:** Unjudged protocol implementation. The shipped public reference packet contains genuine publication identifiers, **zero human judgments** and **zero scored claims**. CI may validate its structure; it cannot establish scientific quality or release readiness.

## Frozen public reference material

- Ioannidis JPA (2005), *Why Most Published Research Findings Are False*, PLOS Medicine 2(8), e124, DOI: 10.1371/journal.pmed.0020124. https://pmc.ncbi.nlm.nih.gov/articles/PMC1182327/
- Ioannidis JPA (2022), *Correction: Why Most Published Research Findings Are False*, PLOS Medicine 19(8), e1004085, DOI: 10.1371/journal.pmed.1004085. https://pmc.ncbi.nlm.nih.gov/articles/PMC9410711/

The links are public reference locations, **not** a claim that EYLO checked Crossref metadata, reviewed full text, or adjudicated scientific findings. The correction is a separate bibliographic record; reviewers must check how it affects any quoted assertion. Source identity alone never proves semantic support. Do not copy full publication text into this repository; preserve references and minimum necessary evidence locators under the applicable content terms.

## Required frozen packet

Each evaluation packet must record an exact 40-character commit SHA, pseudonymous evaluation ID, bibliographic references (DOI/title/year/HTTPS publisher or archive link), generated factual or proposed claims, their selected source IDs, independent claim-level review records and eight dimension-specific reviews. Keep private research content and personal identifiers out of public GitHub.

Bibliographic metadata should be separately checked with Crossref/publisher DOI and correction notices; preserve the checked snapshot, timestamp and provenance under an appropriately protected study record. The offline script checks **format and traceability only** and cannot perform live DOI resolution.

The eight independent dimensions are bibliographic accuracy; claim-level evidence support; research-question coherence; methodological appropriateness; internal consistency; uncertainty disclosure; ethics and reproducibility; and funding-call requirement coverage. Do not collapse the dimensions into one synthetic confidence score.

Claim-level semantic verdicts are:

1. supported_by_inspected_evidence
2. partially_supported
3. unsupported
4. contradicted
5. insufficient_accessible_source_material
6. not_yet_reviewed

For a substantive verdict, a reviewer must identify an original source already linked to the claim, record whether they inspected an abstract, full text, or an official call, give a specific evidence locator, and explain the decision. Metadata-only matching **cannot** support a semantic judgment. An abstract-only support verdict is explicitly counted as abstract-only and **must not** be reported as full-text support. Missing full text should use insufficient material when the available excerpt cannot decide the claim.

Two distinct pseudonymous reviewer IDs per factual claim and per dimension are required before the packet is structurally complete. Disagreements must be adjudicated manually; two IDs are a structural condition, not proof of actual reviewer independence. The accountable study owner must separately verify expertise, blinded procedure, consent, retention and conflict-of-interest safeguards.

## Execution

    node --test tests/scientific-evaluation.test.mjs
    node scripts/evaluate-scientific-workflow.mjs evaluate tests/fixtures/scientific-evaluation/public-reference-packet.json

The CLI additionally binds each review packet's commit_sha to the actual checked-out Git HEAD. The sample reference packet pins the historical main revision and therefore deliberately exits nonzero on any other checkout, even before human review. Do not silently rewrite the sample to pretend evidence exists. A real reviewer must freeze their exact evaluated revision and its corresponding source packet. A real, consented packet may be evaluated locally and the **aggregate-only** report written to a new file with the optional third argument. Avoid committing private review text. CLI output contains counts, codes and statuses only, not claim text, source URLs or reviewer rationale.

The final machine status is either BLOCKED_INVALID, BLOCKED_UNREVIEWED or REVIEW_DATA_COMPLETE_PENDING_INDEPENDENT_ACCEPTANCE. Even the latter **never authorizes a production release**, does not replace human adjudication, and does not satisfy hosted Auth/RLS, Storage, real EYRA, privacy, billing, migration or owner sign-off gates.

For the human study workflow, also use docs/research-workspace-evaluation-protocol.md. Set approval thresholds and adjudication rules **before** collecting participant outputs. Never invent participants, human scores, semantic validation results, funding eligibility or official funding requirements.
