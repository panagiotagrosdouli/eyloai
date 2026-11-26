import test from 'node:test';
import assert from 'node:assert/strict';
import { persistAutonomousProposalCheckpoint } from '../src/lib/autonomous-proposal-checkpoint.mjs';

const run = { run_id: 'run-1', stage: 'draft', status: 'running', updated_at: '2026-11-26T12:00:00.000Z' };
const proposal = { edited_sections: [{ section_id: 'background', claims: [{ text: 'Researcher edit' }] }], section_notes: { background: 'Keep this' } };
const artifact = current => ({ ...current, autonomous_run: run, generation_context: { source_count: 2 } });

test('proposal checkpoint merges onto latest version without overwriting concurrent researcher edits', async () => {
  const initial = { id: 'project-a', updated_date: 'old', research_proposal: { edited_sections: [{ text: 'old' }] } };
  const latest = { id: 'project-a', updated_date: 'new', research_proposal: proposal };
  let writes = 0;
  const saved = { id: 'project-a', updated_date: run.updated_at, research_proposal: artifact(proposal) };
  const result = await persistAutonomousProposalCheckpoint({
    entities: { Project: {
      updateIfUnchanged: async (_id, patch, version) => {
        writes += 1;
        if (writes === 1) throw Object.assign(new Error('concurrent change'), { code: 'ENTITY_CONFLICT' });
        assert.equal(version, 'new');
        assert.equal(patch.research_proposal.edited_sections[0].claims[0].text, 'Researcher edit');
        assert.equal(patch.research_proposal.section_notes.background, 'Keep this');
        return saved;
      },
      get: async () => latest,
    } },
    project: initial, run, ownerId: 'owner-a', getSession: async id => ({ user: { id } }), createArtifact: artifact,
  });
  assert.equal(writes, 2);
  assert.equal(result.research_proposal.autonomous_run.run_id, run.run_id);
});

test('a changed account cannot checkpoint a project', async () => {
  let writes = 0;
  await assert.rejects(persistAutonomousProposalCheckpoint({
    entities: { Project: { updateIfUnchanged: async () => { writes += 1; } } },
    project: { id: 'project-a', updated_date: 'old', research_proposal: {} }, run,
    ownerId: 'owner-a', getSession: async () => ({ user: { id: 'owner-b' } }), createArtifact: artifact,
  }), { code: 'ACCOUNT_CHANGED' });
  assert.equal(writes, 0);
});

test('missing or mismatched checkpoint receipts are rejected', async () => {
  await assert.rejects(persistAutonomousProposalCheckpoint({
    entities: { Project: { updateIfUnchanged: async () => ({ id: 'project-a', research_proposal: {} }) } },
    project: { id: 'project-a', updated_date: 'old', research_proposal: {} }, run,
    ownerId: 'owner-a', getSession: async id => ({ user: { id } }), createArtifact: artifact,
  }), { code: 'CHECKPOINT_UNVERIFIED' });
});
