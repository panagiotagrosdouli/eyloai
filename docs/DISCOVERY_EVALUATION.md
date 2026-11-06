# Discovery evaluation protocol

EYLO discovery should be evaluated as an information-retrieval system, not by visual inspection alone.

## Goals

The evaluation should answer four questions:

1. Are the first results actually relevant to the user's research question?
2. Are duplicate or metadata-child records removed reliably?
3. Does the result set preserve useful source diversity without promoting irrelevant records?
4. Does the system degrade transparently when one or more providers fail?

## Benchmark layers

### 1. Deterministic regression benchmark

`npm run benchmark:relevance` uses synthetic relevant records and adversarial distractors. This protects ranking rules, DOI normalization and metadata-noise filtering from regressions.

This benchmark is necessary but not sufficient because synthetic records are easier than live scholarly search.

### 2. Human-judged offline set

Maintain a versioned set of research tasks covering:

- biomedical research,
- computer science,
- climate and sustainability,
- social science,
- interdisciplinary topics,
- beginner and expert intents,
- recent and foundational literature intents.

For every query, independently label a pooled set of candidate records as relevant, partially relevant or not relevant. Keep judgments separate from the ranking code.

Recommended primary metrics:

- Precision@5
- Precision@10
- nDCG@10
- duplicate rate
- metadata-noise rate
- source diversity at 10
- zero-result rate

Report metrics by domain and user intent, not only as a single aggregate number.

### 3. Live retrieval health and automated anchor diagnostic

`npm run benchmark:relevance:live` queries the configured deployment's `/api/discovery` proxy (production by default, override with `EYLO_LIVE_BASE_URL`). It is an operational health check, not a deterministic CI gate, because upstream indexes can be slow or temporarily unavailable. A proxy error is reported as an error; the check does not silently switch to direct provider requests.

The script also reports **heuristic anchor coverage**, based on literal concept groups. This is not precision, judged relevance, or evidence of scientific quality. It is a coarse diagnostic for obviously off-topic results and must not be used as a substitute for the human-judged set below.

Track:

- provider availability,
- provider latency,
- total retrieval latency,
- partial-result frequency,
- number of unique normalized records,
- source contribution after deduplication.

### 4. Product follow-through

Retrieval quality should also be connected to user actions without treating engagement as scientific relevance. Useful product signals include whether users save a paper, open a source record, create a project from a search or return to a saved search.

These behavioral signals should complement, not replace, human relevance judgments.

## Release criterion

A ranking change should not ship solely because it improves one example. Require:

- no regression in deterministic tests,
- documented results on the human-judged set,
- inspection of the largest wins and losses,
- no material increase in duplicate/noise rate,
- preserved partial-source resilience.

## Scientific interpretation

Citation count, recency and provider relevance scores are ranking signals, not measures of truth or study quality. EYLO should keep source-backed metadata, model inference and uncertainty visually and semantically distinct.


## EYRA scientific claim evaluation (added 2026-11-05)

The separate AI verifier is not a proof system. It uses abstract excerpts and an
additional model call; a genuine quote can accompany a false conclusion when
that model makes a semantic error.

- `npm run benchmark:eyra` is a **free, deterministic quote-integrity diagnostic**.
  It tests a small synthetic set, and reports the known false-acceptance pathway
  when model verdicts are deliberately wrong. Its success must **not** be called
  scientific validation.
- `EYLO_EVAL_LIVE=1 npm run benchmark:eyra:live` is an **explicitly paid, opt-in**
  model benchmark (using shared system instructions). Configure `OPENAI_API_KEY` only in your local protected
  environment; never in the repository or chat. The runner uses the same
  review prompt as production and collects precision, recall, confusion counts,
  total tokens and review latency on the labelled synthetic cases.
- No live-model results have been established merely by adding this runner.

**Release gate for the synthetic probe:** zero false acceptances and at least
75% retention of supported cases. This threshold is an engineering diagnostic,
not a field accuracy estimate. Any failure is a NO-GO for scientific
reliability claims. The real release decision also requires **independently
human-labelled** claims/abstracts, across domains and adversarial phrasing,
with precision/recall and false-acceptance confidence intervals reported per
domain. Include contradictory sources, absent abstracts, causal leaps, subtle
negation, impossible numerical claims, prompt injection and real-paper metadata.
Do not publish an accuracy percentage based only on these illustrative cases.

The benchmark runs no external AI calls unless `--live` and
`EYLO_EVAL_LIVE=1` are both supplied. It does not exercise production user
accounts or change user data.


## Human-adjudicated scientific claim scoring (2026-11-06 candidate)

The `npm run evaluate:eyra:human -- --dataset <path>` command evaluates
independently labelled paper-claim pairs and saved second-model responses
**offline**. It compares raw model judgments with claims actually published
after deterministic excerpt checking, with precision, recall, confusion
counts, per-domain denominators and Wilson 95% false-acceptance bounds.
The evaluator requires real independent adjudication provenance to run in
human-study mode; no such real dataset has been collected or assessed yet.
See `docs/EYRA_HUMAN_EVALUATION.md` for the protocol and stringent
screening thresholds. This is not a production accuracy certification.

The runtime verifier now requires a complete, consistent set of claim IDs;
omissions or duplicates fail closed. That protects against *malformed or
partial review batches*, not a model's coherent but semantically incorrect
support verdict. The prior synthetic 8/8 false-acceptance diagnostic remains
an open scientific reliability blocker.


## Blinded dual-review workflow (2026-11-06)

`npm run prepare:eyra:annotations -- --source <source-only-manifest> --out
<new-private-directory> --seed <preregistered-seed>` creates **two
blinded, independently ordered** reviewer packets without any model answers
or ground-truth labels. Two independent reviewers should annotate each case
without seeing each other’s decisions or EYRA output, and any disagreements
must receive a documented adjudication resolution before model scoring.

`npm run evaluate:eyra:human` now reports *per-domain and overall*
annotator raw agreement and Cohen's κ along with precision, recall and
false-acceptance intervals. A domain needs at least 80% exact agreement
to pass the engineering screening gate, though that alone is not evidence
of ground-truth quality or reviewer independence. No real human study has
been performed or verified. See `docs/EYRA_HUMAN_EVALUATION.md`.
