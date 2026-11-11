import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewSavedGapCandidate, removeSavedGapCandidate } from '../src/lib/gap-candidate-review.mjs';

const example = { question:'Does treatment transfer?', recorded_at:'2026-11-10T12:00:00Z',
  supporting_papers:[{paper_id:'paper-1',title:'Source A'}], counterevidence_papers:[], review_status:'candidate_needs_human_review' };

function fixture() {
  const project={id:'owner-project',gap_candidates:[{...example}]};
  let writes=0;
  const entities={Project:{
    async get(id){ assert.equal(id,project.id);return project; },
    async update(id,patch){assert.equal(id,project.id);writes++;project.gap_candidates=patch.gap_candidates;return {...project};},
  }};
  return {project,entities,getWrites:()=>writes};
}

test('human review persists evidence and rationale without rewriting its provenance', async () => {
  const {entities,project,getWrites}=fixture();
  const saved=await reviewSavedGapCandidate({entities,projectId:project.id,index:0,
    expected:example,status:'needs_more_evidence',note:'We have not assessed evidence outside the sample.',
    reviewedAt:'2026-11-12T10:00:00Z'});
  assert.equal(saved.gap_candidates[0].review_status,'needs_more_evidence');
  assert.equal(saved.gap_candidates[0].reviewer_note,'We have not assessed evidence outside the sample.');
  assert.deepEqual(saved.gap_candidates[0].supporting_papers,example.supporting_papers);
  assert.equal(getWrites(),1);
});

test('substantive review decisions require a researcher-provided rationale', async () => {
  const {entities,project,getWrites}=fixture();
  await assert.rejects(()=>reviewSavedGapCandidate({entities,projectId:project.id,index:0,expected:example,
    status:'selected_for_followup',note:' ',reviewedAt:'2026-11-12T10:00:00Z'}),/Document the reasoning/);
  await assert.rejects(()=>reviewSavedGapCandidate({entities,projectId:project.id,index:0,expected:example,
    status:'verified_gap',note:'yes',reviewedAt:'2026-11-12T10:00:00Z'}),/Unsupported/);
  assert.equal(getWrites(),0);
});

test('stale index or changed candidate never updates the wrong research question', async () => {
  const {entities,project,getWrites}=fixture();
  await assert.rejects(()=>reviewSavedGapCandidate({entities,projectId:project.id,index:0,
    expected:{question:'Another question',recorded_at:example.recorded_at},status:'needs_more_evidence',
    note:'Review pending',reviewedAt:'2026-11-12T10:00:00Z'}),/changed/);
  await assert.rejects(()=>removeSavedGapCandidate({entities,projectId:project.id,index:4,expected:example}),/no longer exists/);
  assert.equal(getWrites(),0);
});

test('removal is explicit and scoped to project owner repository', async () => {
  const {entities,project,getWrites}=fixture();
  const result=await removeSavedGapCandidate({entities,projectId:project.id,index:0,expected:example});
  assert.deepEqual(result.gap_candidates,[]);
  assert.equal(getWrites(),1);
});

test('missing project cannot be reviewed or deleted', async () => {
  const entities={Project:{async get(){return null;}}};
  await assert.rejects(()=>removeSavedGapCandidate({entities,projectId:'missing',index:0,expected:example}),/not found/);
});
