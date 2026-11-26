import test from 'node:test';
import assert from 'node:assert/strict';
import { persistProposalWorkflowCheckpoint } from '../src/lib/research-proposal-checkpoint.mjs';

const run = { run_id: 'run-1', stage: 'SECTION_GENERATION', status: 'running', updated_at: '2026-11-26T12:00:00.000Z' };

test('checkpoint uses a versioned project write and preserves the other proposal fields', async () => {
  const project = { id: 'project-1', updated_date: '2026-11-26T11:59:00.000Z', research_proposal: { edited_sections: [{ section_id: 'background' }], researcher_edited: true } };
  let write;
  const saved = { ...project, updated_date: run.updated_at, research_proposal: { ...project.research_proposal, workflow_run: run } };
  const result = await persistProposalWorkflowCheckpoint({
    project,
    run,
    ownerId: 'owner-1',
    getSession: async expected => ({ user: { id: expected } }),
    entities: { Project: { updateIfUnchanged: async (id, patch, version) => { write = { id, patch, version }; return saved; } } },
  });
  assert.equal(write.id, project.id);
  assert.equal(write.version, project.updated_date);
  assert.deepEqual(write.patch.research_proposal.edited_sections, project.research_proposal.edited_sections);
  assert.deepEqual(result.research_proposal.workflow_run, run);
});

test('checkpoint reloads the latest version after a conflict and retains concurrent researcher edits', async () => {
  const stale = { id: 'project-1', updated_date: 'old', research_proposal: { edited_sections: [{ text: 'old' }] } };
  const latest = { id: 'project-1', updated_date: 'new', research_proposal: { edited_sections: [{ text: 'researcher edit' }], section_notes: { background: 'keep' } } };
  let attempts = 0;
  const saved = { ...latest, updated_date: run.updated_at, research_proposal: { ...latest.research_proposal, workflow_run: run } };
  const result = await persistProposalWorkflowCheckpoint({
    project: stale,
    run,
    ownerId: 'owner-1',
    getSession: async expected => ({ user: { id: expected } }),
    entities: { Project: {
      updateIfUnchanged: async (_id, patch, version) => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('conflict'), { code: 'ENTITY_CONFLICT' });
        assert.equal(version, latest.updated_date);
        assert.equal(patch.research_proposal.edited_sections[0].text, 'researcher edit');
        assert.equal(patch.research_proposal.section_notes.background, 'keep');
        return saved;
      },
      get: async () => latest,
    } },
  });
  assert.equal(attempts, 2);
  assert.equal(result.research_proposal.edited_sections[0].text, 'researcher edit');
});

test('account switching stops the checkpoint before any project write', async () => {
  let writes = 0;
  await assert.rejects(persistProposalWorkflowCheckpoint({
    project: { id: 'project-1', updated_date: 'old' },
    run,
    ownerId: 'owner-1',
    getSession: async () => ({ user: { id: 'owner-2' } }),
    entities: { Project: { updateIfUnchanged: async () => { writes += 1; } } },
  }), { code: 'ACCOUNT_CHANGED' });
  assert.equal(writes, 0);
});
