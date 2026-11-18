import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedEyraApprovedProposal } from '../server/eyra-approved-fields.mjs';
import { proposedEyraWriteActions } from '../server/eyra-write-preview.mjs';

const project = { tool: 'project.create', fields: {
  title: 'Audited title', description: '', goal: '', milestones: '', tasks: '',
} };
const paper = { tool: 'library.save_paper', fields: { doi: '10.1234/abc', title: 'Published article' } };
const call = (tool, fields) => [{ type: 'function_call', name: tool, arguments: JSON.stringify(fields) }];

test('approved inputs retain exactly the canonical reviewed values', () => {
  assert.deepEqual(boundedEyraApprovedProposal(project), project);
  assert.deepEqual(boundedEyraApprovedProposal(paper), paper);
  assert.equal(proposedEyraWriteActions(call('project.create', {
    ...project.fields, title: '  Audited title  ',
  }), { project: true })[0].fields.title, 'Audited title');
});

test('field overflow, noncanonical input and unbounded payload fail before approval', () => {
  for (const proposal of [
    { ...project, fields: { ...project.fields, title: 'x'.repeat(181) } },
    { ...project, fields: { ...project.fields, goal: 'x'.repeat(1501) } },
    { ...project, fields: { ...project.fields, description: 'x'.repeat(2501) } },
    { ...project, fields: { ...project.fields, milestones: 'x'.repeat(2501) } },
    { ...project, fields: { ...project.fields, title: '  changed' } },
    { ...paper, fields: { ...paper.fields, doi: '10.1234/UPPER' } },
    { ...paper, fields: { ...paper.fields, title: 'x'.repeat(1001) } },
  ]) assert.throws(() => boundedEyraApprovedProposal(proposal));
  assert.throws(() => boundedEyraApprovedProposal({ ...project, fields: {
    ...project.fields, description: 'd'.repeat(2490), goal: 'g'.repeat(1490),
    milestones: 'm'.repeat(2490), tasks: 't'.repeat(2490),
  } }), /payload budget/);
});

test('model proposals exceeding executor limits are refused rather than silently truncated on save', () => {
  assert.throws(
    () => proposedEyraWriteActions(call('project.create', {
      ...project.fields, title: 'Too long '.repeat(40),
    }), { project: true }),
    /oversized|Invalid field in tool arguments/,
  );
  assert.throws(
    () => proposedEyraWriteActions(call('library.save_paper', {
      ...paper.fields, title: 'a'.repeat(1001),
    }), { paper: true }),
    /oversized|Invalid field in tool arguments/,
  );
});
