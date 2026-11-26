import test from 'node:test';
import assert from 'node:assert/strict';
import { getResearchWorkflowProgress } from '../src/lib/research-workflow-progress.mjs';

test('research workflow exposes only project-saved outputs as progress', () => {
  const progress = getResearchWorkflowProgress({
    evidence_matrix: { research_question: 'Question' },
    literature_review: null,
    research_proposal: { edited_sections: [] },
    research_methodology: {},
    plan_items: [{ id: 'task-1', title: 'Review protocol' }],
  });
  assert.equal(progress.savedCount, 2);
  assert.equal(progress.total, 4);
  assert.deepEqual(progress.stages.map(stage => stage.status), ['Saved', 'Not started', 'Saved', 'Not started', 'Approval + workplan save required']);
});

test('a saved general workplan is not misreported as a saved roadmap', () => {
  const progress = getResearchWorkflowProgress({ plan_items: [{ id: 'existing', title: 'Existing task' }] });
  assert.equal(progress.savedCount, 0);
  assert.equal(progress.stages.at(-1).saved, false);
  assert.equal(progress.stages.at(-1).status, 'Approval + workplan save required');
});

test('empty, malformed and session-only data does not appear as saved project progress', () => {
  const progress = getResearchWorkflowProgress({
    evidence_matrix: {}, literature_review: [], research_proposal: null,
    research_methodology: 'draft in memory', plan_items: [],
  });
  assert.equal(progress.savedCount, 0);
  assert.equal(progress.total, 4);
  assert.equal(progress.stages.every(stage => !stage.saved), true);
});
