// Deterministic quote-integrity diagnostic by default. --live performs paid,
// opt-in AI calls on synthetic labelled examples, using the production prompt.
import { EVIDENCE_REVIEW_CASES as CASES } from '../tests/fixtures/eyra-review-cases.mjs';
import { reviewableClaims, selectExcerptSupportedClaims } from '../src/lib/evidence-verification.mjs';
import { buildEvidenceReviewPrompt, EVIDENCE_REVIEW_SCHEMA } from '../src/lib/evidence-review-prompt.mjs';

const synth = item => ({
  papers: [{ title: item.title, summary: item.abstract, url: 'https://example.org/illustrative-only' }],
  analysis: { key_findings: [{ finding: item.claim, evidence: 'Source [P1]' }], trends: [] },
});
const modelClaim = (verdict, quote = '') => ({
  claim_id: 'F0', verdict, source_id: 'P1', quote, explanation: '',
});
const accepted = (item, reviews) => {
  const { analysis, papers } = synth(item);
  return selectExcerptSupportedClaims(analysis, reviews, papers).key_findings.length > 0;
};

const positive = CASES.filter(item => item.expected_supported);
const negative = CASES.filter(item => !item.expected_supported);
const goodQuotes = positive.every(item => accepted(item, [modelClaim('supported', item.abstract)]));
const rejectsFakeQuotes = CASES.every(item => !accepted(item, [modelClaim('supported', 'Invented quotation not found in any source abstract') ]));
const rejectsNonSupportVerdicts = CASES.every(item => !accepted(item, [modelClaim('insufficient', item.abstract)]));
const wronglyApproved = negative.filter(item => accepted(item, [modelClaim('supported', item.abstract)]));

console.log('EYRA deterministic quote-integrity diagnostic (synthetic cases)');
console.table([
  { check: 'Correctly quoted and model-supported examples', passed: goodQuotes },
  { check: 'Fabricated quotations blocked', passed: rejectsFakeQuotes },
  { check: 'Explicit insufficient verdicts blocked', passed: rejectsNonSupportVerdicts },
]);
console.log(`KNOWN SEMANTIC BLIND SPOT: ${wronglyApproved.length}/${negative.length} unsupported claims pass if the AI reviewer erroneously returns supported with a genuine quotation.`);
console.log('A verbatim quote is NOT proof of claim entailment. The deterministic check is NOT a scientific accuracy benchmark.');
if (!goodQuotes || !rejectsFakeQuotes || !rejectsNonSupportVerdicts) process.exitCode = 1;

if (process.argv.includes('--live')) {
  if (process.env.EYLO_EVAL_LIVE !== '1') throw new Error('Set EYLO_EVAL_LIVE=1 to authorize paid evaluation requests.');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY must be configured locally or in a protected environment. Never paste it into chat or commit it.');
  const model = process.env.EYLO_EVAL_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6';
  const required = schema => schema.type === 'object'
    ? { type: 'object', properties: Object.fromEntries(Object.entries(schema.properties || {}).map(([k, v]) => [k, required(v)])), required: Object.keys(schema.properties || {}), additionalProperties: false }
    : schema.type === 'array' ? { type: 'array', items: required(schema.items || { type: 'string' }) } : schema;
  let tp = 0, fp = 0, fn = 0, tn = 0, totalMs = 0, tokens = 0;
  for (const item of CASES) {
    const { analysis, papers } = synth(item);
    const startedAt = performance.now();
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, store: false,
        input: buildEvidenceReviewPrompt(reviewableClaims(analysis), papers),
        text: { format: { type: 'json_schema', name: 'eyra_evaluation', strict: true, schema: required(EVIDENCE_REVIEW_SCHEMA) } },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    totalMs += performance.now() - startedAt;
    if (!response.ok) throw new Error(`Reviewer API returned HTTP ${response.status}; stopping without retrying paid calls.`);
    const payload = await response.json();
    if (payload.status !== 'completed') throw new Error(`Reviewer generation incomplete for case ${item.id}.`);
    tokens += Number(payload.usage?.total_tokens || 0);
    const output = (payload.output || []).flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n');
    const result = JSON.parse(output);
    const isAccepted = accepted(item, result.reviews);
    if (isAccepted && item.expected_supported) tp++;
    else if (isAccepted) fp++;
    else if (item.expected_supported) fn++;
    else tn++;
    console.log(`${item.id}: expected=${item.expected_supported ? 'supported' : 'not_supported'} retained=${isAccepted}`);
  }
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  console.table([{ model, cases: CASES.length, tp, fp, tn, fn,
    precision: precision?.toFixed(3) || 'n/a', recall: recall?.toFixed(3) || 'n/a',
    total_review_latency_ms: Math.round(totalMs), total_tokens: tokens }]);
  const gatePassed = fp === 0 && recall !== null && recall >= 0.75;
  console.log(`SYNTHETIC EVALUATION GATE: ${gatePassed ? 'PASS' : 'FAIL'} (zero false accepts and recall >= 0.75 required).`);
  console.log('The same model prompt is used in production. Synthetic examples are not a substitute for human-judged domain evaluation.');
  if (!gatePassed) process.exitCode = 1;
}
