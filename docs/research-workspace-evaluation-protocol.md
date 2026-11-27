# EYLO Research Workspace Evaluation Protocol

**Status:** Draft preparation document. No researcher sessions have been run and no scientific-quality results are claimed.

## Purpose

Evaluate whether researchers can complete the project workflow—Scientific Discovery, Evidence Matrix, Literature Review, Proposal, Methodology, and Roadmap—while retaining control of saved content and understanding what EYRA did and did not establish.

Run two distinct evaluations:

1. **Workflow usability:** navigation, source inspection, editing, saving, recovery, export, accessibility, and roadmap approval.
2. **Scientific output quality:** claim-level source support, uncertainty, citation accuracy, and methodological fit as judged by domain researchers.

Passing the first evaluation does not imply scientific validity. Identifier or citation-format checks are provenance checks only; they do not establish that a source supports a claim.

## Participants and safeguards

- Recruit researchers who use scholarly literature in their work. Record discipline and research experience using broad categories; do not collect institution, employer, health, or other sensitive details unless a separately approved study requires them.
- Include different levels of familiarity with AI-assisted research tools and at least one participant who primarily uses keyboard navigation. Include mobile use only with participants who use research tools on mobile.
- Before recruitment, have the study owner confirm consent language, retention, access, compensation, and whether institutional ethics review is required.
- Use a disposable project with public scholarly records or synthetic records. Do not use confidential manuscripts, identifiable participant data, unpublished results, private project records, or production accounts.
- Do not enable live billing or modify production data. Do not ask participants to submit or publish generated content.
- Obtain permission before recording audio, video, screen content, or quotations. Prefer structured observer notes over recordings.

## Session preparation

For each session, record:

- A pseudonymous participant code, broad discipline, research experience band, session date, and moderator.
- Exact application commit, preview identifier, browser, operating system, viewport, and input mode.
- The disposable project identifier and public/synthetic source identifiers used in the session.
- Which project context and publications were selected for each generation.
- Whether EYRA provider/model/version and full generation context are available in the product. Record unavailable fields as unavailable; do not infer them.

Prepare a project with a realistic research question and a small set of public or synthetic scholarly records. Confirm that source titles, authors, years, DOI/URLs, and abstracts in the fixture are internally consistent. Use the same fixture across participants for comparable observations; allow a second participant-selected topic only as a separately reported exploratory task.

## Moderated task sequence

Ask participants to think aloud, but do not teach the interface during a task. If they ask for help, record the question and provide only the minimum clarification needed to continue.

1. **Find evidence:** search for publications relevant to the project question, inspect a source, and link selected records to the project.
2. **Build the Evidence Matrix:** review an EYRA draft, edit one finding, inspect its linked source, save, reload, and confirm the researcher edit remains.
3. **Write a Literature Review:** choose the source set and context, inspect the draft’s claims and citations, edit a claim, save, reload, and export Markdown.
4. **Draft a Proposal:** select upstream context explicitly, identify one claim that needs researcher review, edit it, save, reload, and export.
5. **Draft Methodology:** inspect proposed methods and their source links, distinguish proposals from reported implementation, edit and save the methodology, then reload it.
6. **Plan the work:** generate a roadmap, edit a proposed task, and describe what “approve” will do. Verify that generation alone does not change the project workplan; approve only the participant-selected tasks, separately save the workplan, reload, and verify it.
7. **Recover from a conflict:** on a disposable fixture, create a stale project version and attempt a save. Check that the winning saved record remains intact and local researcher edits remain recoverable.
8. **Keyboard and mobile pass:** complete navigation between all stages using keyboard only, then repeat stage discovery and navigation at a 390 px viewport. Record focus order, visible focus, horizontal scrolling, page overflow, and whether controls remain usable.

Stop a task if it would require a real account, sensitive data, a production write, an external submission, or enabling billing.

## Usability observations

For each task, record:

- Completed independently, completed with help, abandoned, or failed.
- Time to completion, navigation detours, source-inspection actions, errors, recovery actions, and points of uncertainty.
- Whether the participant could distinguish an AI draft from researcher-authored or researcher-approved content.
- Whether save state, reload behavior, conflict recovery, and export were understood without moderator explanation.
- Whether a roadmap task was added only after explicit approval and a separate workplan save.
- Keyboard focus order, focus visibility, scroll behavior, and horizontal or vertical overflow.

After the tasks, ask which stage was hardest to find, where project context felt missing or repetitive, what content they would not trust without checking, and what they would change before using the workflow on a real project. A standardized usability scale may be added only when a suitable validated language version and scoring procedure are selected in advance; report it separately from task performance.

## Claim-level scientific review

Before reviewing outputs, two domain researchers should agree on the rating rubric and review independently. Give reviewers the generated artifact, the exact selected source records and available abstracts, the research question, and the recorded context selection. Hide participant identity and each other’s ratings where practical.

Rate each factual or interpretive claim against its cited source:

| Claim-level verdict | Meaning |
|---|---|
| Supported by inspected evidence | The material actually inspected directly supports the precisely scoped claim; record whether it was abstract or full text. |
| Partially supported | Some wording is supported, but scope, population, certainty, design or result is incomplete or overstated. |
| Unsupported | The inspected material is sufficient to judge the claim but does not provide the stated support. |
| Contradicted | Inspected evidence states an incompatible result; explain the contradiction and source location. |
| Insufficient accessible source material | The accessible material cannot establish support or contradiction; never relabel missing full text as unsupported. |
| Not yet reviewed | No independent scientific judgment has been completed. |

Identify proposed work and open research questions separately as **not a factual source claim**; this is a claim-type classification, not a seventh semantic evidence verdict. Metadata/DOI resolution verifies bibliographic identity only and cannot earn a support verdict. Abstract-only review must be separately reported as abstract-only; it cannot be described as full-text verification. Inspect publisher correction or retraction notices when relevant and record both source version and inspection locator. Use `src/lib/scientific-evaluation.mjs` and `docs/scientific-evaluation-runbook.md` for the fail-closed, eight-dimension offline evaluation packet.

Also record citation-to-record match, whether uncertainty is appropriately stated, whether the text implies unavailable full-text review, whether a proposal is presented as an observed result, and whether methods fit the stated question and discipline. Review bibliography metadata and DOI/URL resolution separately from semantic claim support.

Report each reviewer’s ratings, disagreements, adjudication, missing source material, and the denominator of claims reviewed. Do not convert “unsupported” into a model error rate without explaining the review sample and coding rules. Do not describe this exercise as peer review or independent validation of the scientific field.

## Analysis and decision record

- Summarize task outcomes and observed failures by workflow stage, input mode, viewport, and relevant participant category. Report counts and denominators; avoid generalizing beyond the recruited participants.
- Summarize claim ratings and reviewer disagreement separately from usability metrics and automated identifier checks.
- Preserve anonymized task notes, the fixed fixture, rubric version, exact commit/build identity, test configuration, and analysis decisions so another reviewer can reproduce the assessment.
- Before sessions begin, the study owner and scientific reviewers must set decision thresholds and identify critical failures. At minimum, a researcher edit overwritten without consent, a roadmap write without explicit approval and separate save, cross-project data exposure, a fabricated citation presented as real, or a privacy/security incident stops the affected pilot and triggers review.
- Publish no participant quotations, screenshots, or project content without the consent and review required by the approved protocol.

## Readiness gaps to resolve before a real pilot

- Identify an accountable study owner, participating disciplines, recruitment channel, consent and retention process, and required institutional review.
- Confirm that the selected preview is isolated from production and that disposable accounts and projects are available.
- Decide which generation context and version fields the product can expose reproducibly. If model/provider version or selected-context metadata cannot be captured, label that limitation in the study record and do not claim full generation reproducibility.
- Complete hosted Auth/RLS, Storage isolation, live EYRA provider, privacy, and operational acceptance before using non-synthetic private research data.
- Define human scientific review thresholds before collecting outputs. Automated source-ID validation alone is not an acceptance criterion.
