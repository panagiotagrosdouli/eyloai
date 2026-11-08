# EYLO Discovery Benchmark v1 — human-judged protocol

## Current status
This repository includes **50 curated research questions**, an annotation template generator, and a deterministic scoring engine. **No human relevance labels or validated Precision@5/nDCG@10 scores have been collected yet.** The existing synthetic ranking regression and live anchor diagnostic are separate, and must not be represented as this benchmark's results.

## Research design
- Five domains, 10 queries each: computer science, biomedicine, climate/sustainability, social sciences, interdisciplinary.
- A range of research intents and novice/researcher levels.
- Freeze the exact queries and retrieval snapshot with the production commit, retrieval date (UTC), settings (level/goal/recency), enabled sources, provider failures, and deployment URL.
- Capture at least the **top 10** EYLO results for each query. Store stable DOI/ID, title, publication year, source index and source URL. Avoid identifying users or storing CV text.
- Ideally pool top results from at least one baseline (e.g. OpenAlex relevance ranking) for stronger comparative scientific claims; maintain a consistent labeling protocol across methods.
- Two independent annotators per query are recommended. Randomize record order for annotation and hide system rankings/source identity where practical. Resolve disagreements by adjudication and report agreement (e.g. weighted Cohen's kappa); do not silently average incompatible labels.
- Relevance rubric: **0 = irrelevant** to the research need; **1 = partially relevant** (related but insufficient focus/method/context); **2 = directly relevant** (answers or materially informs the research question). A paper is not necessarily high-quality because it is relevant.
- Specify ahead of time whether retracted papers, metadata-only notices, inaccessible full text, duplicate versions and non-paper records are excluded or judged.
- Report a domain-level and intent-level breakdown, query counts, missing results and source outages.

## Snapshot schema
Create a JSON file such as `benchmarks/discovery/results-2026-11-07.json`:

```json
{
  "queries": [
    {
      "id": "COM-01",
      "domain": "computer_science",
      "intent": "review",
      "results": [
        {"id": "W123456", "doi": "10.1234/example", "title": "Example source", "source_index": "OpenAlex"}
      ]
    }
  ]
}
```

This is **schema illustration, not real retrieved evidence**. In actual runs use query IDs from `queries.v1.json` and record real search responses and retrieval metadata. The evaluator does not retrieve anything itself.

## Procedure
1. Freeze retrieval snapshots before seeing or changing relevance grades.
2. Run `node scripts/evaluate-discovery.mjs template path/to/results.json path/to/labels.json`. The command refuses to overwrite an existing annotation file.
3. Have independent reviewers inspect the actual paper title/abstract and source page; assign each label a grade `0`, `1`, or `2`, an annotator identifier, and short justification. The template's `null` grade **must be replaced**. Avoid recording personally identifying information in reviewer identifiers.
4. Adjudicate conflicting ratings to one final, versioned label per query/record; keep raw independent ratings separately. Include all top-10 results and any additional judged pooled records in the final judgment file.
5. Run `node scripts/evaluate-discovery.mjs evaluate path/to/results.json path/to/adjudicated-labels.json path/to/report.json`.
6. Review results manually and report uncertainty intervals (e.g. query-level bootstrap 95% confidence intervals), per-domain performance, examples of false positives, duplicate records, source downtime, and limitations. Baseline comparisons should use paired query-level tests.

## Metrics and safeguards
- **Precision@5** uses binary relevant = grade 2. The denominator is 5 even when fewer results appear.
- **nDCG@10** uses graded gain `2^grade - 1` and logarithmic discount; ideal ranking is computed from all assessed pooled items.
- Duplicate records occupy ranks but get no second relevance credit.
- Other output: top-10 duplicate rate, source diversity, and zero-result rate.
- Unjudged top-ranked records cause an explicit error; **unjudged is never treated as irrelevant**. Empty response is treated as empty retrieval, not evidence of irrelevance.
- A low score may arise from upstream source outages, topic ambiguity or weak ranking; analyze failures separately.
- Do not select a ranking change based on the same benchmark it is scored on: use a development set and an untouched holdout test set.
- This framework does **not** prove correctness of papers, evidence synthesis, EYRA citations, or research-gap proposals.

## Publication readiness
Publishing a scientific comparison requires real independent annotations, a frozen baseline and retrieval configuration, detailed error analysis, appropriate uncertainty estimates, provenance, and a replicable artifact. Until then label all outputs as engineering diagnostics, not peer-reviewed scientific findings.
