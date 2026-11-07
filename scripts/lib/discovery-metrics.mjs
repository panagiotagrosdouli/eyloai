// Pure information-retrieval metrics. No query/result relevance is inferred by this module.
export const canonicalRecordId = record => {
  const doi = String(record.doi || '').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '');
  if (doi) return `doi:${doi}`;
  const id = String(record.id || '').trim().toLowerCase();
  if (!id) throw new Error('Result is missing an ID and a DOI.');
  return `id:${id}`;
};

export function precisionAtK(grades, k = 5, threshold = 2) {
  if (!Number.isInteger(k) || k < 1) throw new Error('k must be a positive integer.');
  // A search returning 3 relevant papers for P@5 has 3/5, not 3/3.
  return grades.slice(0, k).filter(grade => grade >= threshold).length / k;
}

export function dcgAtK(grades, k = 10) {
  if (!Number.isInteger(k) || k < 1) throw new Error('k must be a positive integer.');
  return grades.slice(0, k).reduce((sum, grade, index) =>
    sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
}

export function ndcgAtK(grades, idealGrades, k = 10) {
  const ideal = [...idealGrades].sort((a, b) => b - a);
  const max = dcgAtK(ideal, k);
  return max ? dcgAtK(grades, k) / max : 0;
}

export function evaluateQuery({ results, judgments, k = 10 }) {
  if (!Array.isArray(results) || !Array.isArray(judgments)) throw new Error('results and judgments must be arrays.');
  const map = new Map();
  for (const row of judgments) {
    if (!['0', '1', '2'].includes(String(row.grade))) throw new Error('Grades must be 0, 1 or 2.');
    if (!row.record_id) throw new Error('Judgments require record_id.');
    if (map.has(row.record_id)) throw new Error(`Duplicate judgment: ${row.record_id}`);
    map.set(row.record_id, Number(row.grade));
  }
  const seen = new Set();
  const top = results.slice(0, k);
  const duplicates = top.filter(row => {
    const id = canonicalRecordId(row);
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  }).length;
  const missing = top.map(canonicalRecordId).filter(id => !map.has(id));
  // Never turn missing labels into zero-relevance labels: that biases metrics.
  if (missing.length) throw new Error(`Unjudged top-${k} records: ${missing.join(', ')}`);
  const grades = top.map(row => map.get(canonicalRecordId(row)));
  const idealGrades = judgments.map(row => Number(row.grade));
  const sources = new Set(top.map(row => row.source_index).filter(Boolean));
  return {
    precision_at_5: precisionAtK(grades, 5),
    ndcg_at_10: ndcgAtK(grades, idealGrades, 10),
    judged_at_10: top.length,
    duplicates_at_10: duplicates,
    duplicate_rate_at_10: top.length ? duplicates / top.length : 0,
    sources_at_10: sources.size,
    zero_results: results.length === 0,
  };
}

export function summarize(rows) {
  if (!rows.length) throw new Error('No evaluated queries.');
  const mean = key => rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
  return {
    queries: rows.length, precision_at_5: mean('precision_at_5'),
    ndcg_at_10: mean('ndcg_at_10'), duplicate_rate_at_10: mean('duplicate_rate_at_10'),
    zero_result_rate: rows.filter(row => row.zero_results).length / rows.length,
    mean_source_diversity_at_10: mean('sources_at_10'),
  };
}
