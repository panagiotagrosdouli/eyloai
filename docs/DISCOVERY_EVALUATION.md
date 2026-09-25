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

### 3. Live retrieval health

`npm run benchmark:relevance:live` should be used as an operational check rather than a deterministic CI gate because upstream indexes can be slow or temporarily unavailable.

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
