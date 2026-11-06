# EYRA — Independently adjudicated claim evaluation protocol

**Status: no independent human study has been completed. This tool does not
certify EYRA for scientific, clinical or commercial use.**

## Distinguish the two checks

1. The deterministic quote check verifies that a model-returned excerpt
   appears in the cited abstract. A genuine quote does not prove the
   claim's meaning; the synthetic benchmark demonstrates this failure mode.
2. The independent review dataset records expert judgments of the **claim
   relative to its actual source excerpt**. Two independent readers label
   each case before seeing the model's answer, then agree an adjudicated
   verdict. No self-labels from EYRA count as ground truth.

Use the four verdicts `supported`, `partial`, `unsupported` and
`insufficient`. Only `supported` counts as a positive for the
publication gate. Partial/unsubstantiated statements are negatives.
Store source identifiers, publication title, source abstract, claim,
two independent labels, reasoned adjudication, and the *exact output*
of the deployed reviewer model on the corresponding claim.

## Dataset (local JSON; do not commit confidential or licensed full text)

```json
{
  "protocol": "eyra-abstract-claim-v1",
  "dataset_id": "YOUR-REAL-STUDY-ID",
  "label_origin": "independent_human_adjudication",
  "cases": [
    {
      "id": "stable-case-id",
      "domain": "medicine",
      "claim": "A claim to check against the abstract.",
      "paper": {
        "title": "Actual source title",
        "abstract": "The abstract, with enough information to judge the claim.",
        "url": "https://doi.org/YOUR-REAL-DOI"
      },
      "independent_labels": [
        { "reviewer_id": "reviewer-a", "verdict": "insufficient" },
        { "reviewer_id": "reviewer-b", "verdict": "insufficient" }
      ],
      "adjudicated_verdict": "insufficient",
      "adjudication_rationale": "Explain specifically why this abstract cannot justify the claim.",
      "model_review": {
        "claim_id": "F0",
        "verdict": "insufficient",
        "source_id": "P1",
        "quote": "",
        "explanation": "Saved model review output, not a generated label"
      }
    }
  ]
}
```

The example above is **schema illustration**, not evaluated human data.
The evaluator now reports **per-domain and overall** raw agreement,
disagreement counts and four-category Cohen's κ in addition to the
AI metrics. If the category marginals make chance agreement 100%, κ is
reported as `null` (undefined), not falsely as perfect reliability.
As a conservative *engineering screening* threshold, each domain must
have at least 80% raw reviewer agreement. This is not a universal
psychometric quality standard and does not establish correct labels.

The CLI cannot verify that the reviewers were independent; separate
annotation records, conflicts, pre-registration, sampling and signed
adjudication must be audited by the research lead.

## Preparing blinded annotation packets (no AI calls)

Create a **private, source-only** manifest with claims sampled independently
from actual scientific papers. The manifest must NOT include human labels,
model predictions or adjudications. It has the following structure:

```json
{
  "protocol": "eyra-source-candidates-v1",
  "dataset_id": "YOUR-PREREGISTERED-STUDY",
  "cases": [
    {
      "id": "case-001",
      "domain": "medicine",
      "claim": "The trial showed a statistically significant effect.",
      "paper": {
        "title": "Publication title from the actual record",
        "abstract": "An authentic abstract excerpt, long enough to assess the proposed claim.",
        "url": "https://doi.org/YOUR-REAL-DOI"
      }
    }
  ]
}
```

This is only a schema example. No real papers, labels or permission to
reproduce copyrighted text are supplied by the repository.

To generate two **blinded, source-only** packets in a new private output
directory (not already existing):

```bash
npm run prepare:eyra:annotations -- \
  --source /secure/study/source-candidates.json \
  --out /secure/study/blind-packets \
  --seed PREREGISTERED-SEED
```

The local-only command writes `reviewer-a.json`,
`reviewer-b.json` and `source-audit.json` containing source SHA-256,
sampling seed, dataset ID and case count. Packets are deterministically
ordered separately for each reviewer and contain **neither predicted
verdicts nor ground-truth labels**. They include blank `verdict` and
`rationale` fields. Use separate secure distribution, have annotators
work independently, and collect both completed responses before showing
either analyst's judgments or any EYRA predictions.

The script refuses extra source case fields (including `model_review`,
`adjudicated_verdict` and `expected_supported`), repeated IDs, and
preexisting target directories. The seed enables replication, not
independence or source authenticity. Do not commit actual manuscripts,
personal reviewer identities or proprietary abstracts.

Reconcile the two completed packets using an independent adjudicator,
recording each original reviewer ID and verdict. If reviewers disagree,
or adjudication overrides both agreeing reviewers, the final evaluation
file must include an `adjudication_resolution` explanation of **at
least 15 characters** per affected case. Ordinary adjudication still
requires the separate `adjudication_rationale` field. Attach the saved
AI reviewer response only **after** independent annotation and
adjudication have been finalized. This workflow cannot itself prove
that humans did the labeling; audit independent annotations and their
timestamps separately.

## Offline evaluation

With a private, adjudicated JSON file and its saved model responses, run:

```bash
npm run evaluate:eyra:human -- --dataset /secure/path/adjudicated-cases.json
```

This makes **no external API calls** and sends no confidential text to
OpenAI, Supabase or Vercel. Only aggregate confusion counts, precision,
recall and two-sided Wilson 95% false-acceptance intervals are printed.
The evaluator separately scores the raw AI reviewer `supported` verdict
and the **post-processed claims that EYRA would actually display**.
Missing model outputs are not treated as correctly rejected claims.

### Engineering screening thresholds (not a launch decision)

- At least four independently represented scientific domains.
- At least 80% exact independent-annotator agreement in *each* domain; report Cohen's κ and the complete disagreement resolution log.
- At least **20 positive and 75 negative** adjudicated claims in *each*
  domain, to avoid overly narrow zero-error claims. The 75 negative
  threshold permits a Wilson upper bound below 5% only if no false
  acceptances occur.
- **Zero published false acceptances** across the measured cases,
  two-sided 95% Wilson false-acceptance upper bound at most 5% in
  each domain, and at least 75% overall recall.

Passing this screening is **not** sufficient to launch or claim a
5% field error rate: sampling bias, real-world case mix, ambiguity,
correlated citations, metadata problems, inter-rater reliability,
false negatives, and new model versions all require independent
review. Report per-domain denominators and CI, and re-evaluate
after changing model, prompt, retrieval or post-processing.

This protocol can expose semantic contradictions missed by the
current post-processor, but it cannot automatically repair them.
Keep the research reliability release gate **NO-GO** until a genuine
independent study is performed and signed off.
