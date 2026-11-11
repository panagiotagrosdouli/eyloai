import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectPlanDraft, acceptProjectPlanDraft } from '../src/lib/project-plan-draft.mjs';

test('plan template uses existing milestones without inventing dates or scientific results', () => {
  const draft = buildProjectPlanDraft('- Collect interviews\n2. Analyze survey responses');
  assert.match(draft, /Milestone: Collect interviews/);
  assert.match(draft, /Milestone: Analyze survey responses/);
  assert.match(draft, /Document search strategy/);
  assert.doesNotMatch(draft, /2027|guaranteed|automatically saved/i);
});

test('existing human tasks are not repeated in generated draft', () => {
  const draft = buildProjectPlanDraft('Collect interviews', '- [x] Define research question, deliverables and success criteria\n- [ ] Milestone: Collect interviews');
  assert.doesNotMatch(draft, /Define research question/);
  assert.doesNotMatch(draft, /Milestone: Collect interviews/);
});

test('accepted, edited plan is appended explicitly without replacing or duplicating tasks', () => {
  const merged = acceptProjectPlanDraft('- [x] Existing task', '- [ ] Existing task\n- [ ] Design interview guide\n- [ ] Design interview guide');
  assert.equal(merged, '- [x] Existing task\n- [ ] Design interview guide');
});

test('empty drafts do not alter existing tasks, long milestone lines are bounded', () => {
  assert.equal(acceptProjectPlanDraft('- [ ] Paper screening', ''), '- [ ] Paper screening');
  const draft = buildProjectPlanDraft('x'.repeat(500));
  assert.ok(draft.includes('Milestone: ' + 'x'.repeat(240)));
  assert.ok(!draft.includes('x'.repeat(241)));
});
