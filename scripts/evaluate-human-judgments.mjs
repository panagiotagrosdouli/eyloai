#!/usr/bin/env node
/**
 * Offline, human-judged information retrieval evaluation.
 *
 * Usage:
 *   node scripts/evaluate-human-judgments.mjs path/to/judgments.json
 *
 * Input schema:
 * { "queries": [
 *   { "id": "q1", "domain": "robotics", "intent": "foundational",
 *     "results": [{"id":"doi:10.x/abc"},{"id":"record2"}],
 *     "judgments": {"doi:10.x/abc": 2, "record2": 0} }
 * ] }
 *
 * Grades: 0=irrelevant, 1=partially relevant, 2=highly relevant.
 * Unjudged results are excluded from scored queries rather than silently
 * counted as irrelevant. A query is scored only if all top-10 results
 * (or all available when fewer) are judged.
 */
import fs from 'node:fs';

export function dcg(grades, k = 10) {
  return grades.slice(0,k).reduce((sum,g,i)=>sum + (Math.pow(2,g)-1)/Math.log2(i+2),0);
}
export function scoreQuery(query) {
  const results=query.results || [];
  const judgments=query.judgments || {};
  if(!results.length) return {id:query.id, status:'unscored', reason:'no retrieved results'};
  const top=results.slice(0,10);
  if(top.some(x=>!Object.hasOwn(judgments,x.id))) return {id:query.id,status:'unscored',reason:'missing judgments in top 10'};
  const ids=results.map(x=>x.id);
  const grades=top.map(x=>judgments[x.id]);
  if(grades.some(g=>![0,1,2].includes(g))) throw Error('Invalid grade in '+query.id);
  const p5=grades.slice(0,5).filter(g=>g>=1).length/Math.min(5,grades.length);
  const p10=grades.filter(g=>g>=1).length/grades.length;
  const ideal=Object.values(judgments).sort((a,b)=>b-a);
  const denom=dcg(ideal,10);
  const ndcg=denom>0?dcg(grades,10)/denom:1;
  const duplicateRate=(ids.length-new Set(ids).size)/ids.length;
  return {id:query.id,domain:query.domain||'unspecified',intent:query.intent||'unspecified',
    status:'scored',precision_at_5:p5,precision_at_10:p10,ndcg_at_10:ndcg,duplicate_rate:duplicateRate};
}
export function summarize(rows) {
  const scored=rows.filter(r=>r.status==='scored');
  const avg=k=>scored.length?Number((scored.reduce((a,r)=>a+r[k],0)/scored.length).toFixed(4)):null;
  return {total_queries:rows.length,scored_queries:scored.length,unscored_queries:rows.length-scored.length,
    precision_at_5:avg('precision_at_5'),precision_at_10:avg('precision_at_10'),
    ndcg_at_10:avg('ndcg_at_10'),duplicate_rate:avg('duplicate_rate')};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href) {
  const file=process.argv[2];
  if(!file) { console.error('Usage: node scripts/evaluate-human-judgments.mjs <judgments.json>'); process.exitCode=2; }
  else {
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!Array.isArray(data.queries)) throw Error('Expected top-level queries array');
    const rows=data.queries.map(scoreQuery);
    console.log(JSON.stringify({summary:summarize(rows),per_query:rows},null,2));
    if(rows.some(x=>x.status!=='scored')) process.exitCode=1;
  }
}
