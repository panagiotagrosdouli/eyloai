import test from 'node:test';
import assert from 'node:assert/strict';
import { readGrantDraftForProject } from '../src/lib/grant-draft-context.mjs';

test('grant drafts are returned only for their associated project', () => {
  const draft = { fit_summary: 'drafted from project one' };
  const opportunity = {
    application_draft: JSON.stringify(draft),
    application_project_id: 'project-one',
    project_id: 'project-two',
  };
  assert.deepEqual(readGrantDraftForProject(opportunity, 'project-one'), draft);
  assert.equal(readGrantDraftForProject(opportunity, 'project-two'), null);
});

test('legacy drafts are shown only for the saved opportunity project', () => {
  const opportunity = { application_draft: { fit_summary: 'legacy' }, project_id: 'project-one' };
  assert.deepEqual(readGrantDraftForProject(opportunity, 'project-one'), { fit_summary: 'legacy' });
  assert.equal(readGrantDraftForProject(opportunity, 'project-two'), null);
  assert.equal(readGrantDraftForProject({ application_draft: {} }, 'project-one'), null);
});

test('missing or malformed grant drafts are unavailable', () => {
  assert.equal(readGrantDraftForProject(null, 'project-one'), null);
  assert.equal(readGrantDraftForProject({ application_draft: '{' , project_id: 'project-one' }, 'project-one'), null);
  assert.equal(readGrantDraftForProject({ application_draft: '[]', project_id: 'project-one' }, 'project-one'), null);
});
