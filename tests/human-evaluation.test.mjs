import test from 'node:test';
import assert from 'node:assert/strict';
import {dcg,scoreQuery,summarize} from '../scripts/evaluate-human-judgments.mjs';

test('DCG discounts later ranked findings',()=>{
  assert.ok(dcg([2,0])>dcg([0,2]));
});
test('an entirely judged good ranking has full scores',()=>{
  const result=scoreQuery({id:'robotics',domain:'robotics',results:[{id:'a'},{id:'b'}],judgments:{a:2,b:1}});
  assert.equal(result.status,'scored');
  assert.equal(result.precision_at_5,1);
  assert.equal(result.ndcg_at_10,1);
});
test('unjudged papers must not silently count as irrelevant',()=>{
  const result=scoreQuery({id:'x',results:[{id:'a'},{id:'missing'}],judgments:{a:2}});
  assert.equal(result.status,'unscored');
  assert.equal(summarize([result]).scored_queries,0);
});
test('repeated retrieved ids are recorded as duplicates',()=>{
  const r=scoreQuery({id:'x',results:[{id:'a'},{id:'a'}],judgments:{a:2}});
  assert.equal(r.duplicate_rate,0.5);
});
test('invalid relevance grades are rejected',()=>{
  assert.throws(()=>scoreQuery({id:'x',results:[{id:'a'}],judgments:{a:5}}),/Invalid grade/);
});
