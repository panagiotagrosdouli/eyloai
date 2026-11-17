import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  proposedEyraWriteActions, EYRA_WRITE_PREVIEW_INSTRUCTIONS,
} from '../server/eyra-write-preview.mjs';

const call = (name, fields) => ({ type: 'function_call', name, arguments: JSON.stringify(fields), call_id: 'call_example' });
const project = { title: 'Reproducibility audit', description: 'Protocol', goal: 'Validate', milestones: '', tasks: '' };

test('exact write preview preserves only model-proposed fields without adding or executing a record', () => {
  const proposals = proposedEyraWriteActions([call('project.create', project)], { project: true, paper: false });
  assert.deepEqual(proposals, [{ tool: 'project.create', fields: project }]);
  assert.deepEqual(proposedEyraWriteActions([{ type: 'message', content: [] }], { project: true }), []);
  assert.match(EYRA_WRITE_PREVIEW_INSTRUCTIONS, /not authorization to persist anything/);
});

test('write preview fails closed for read tools, forbidden writes, repeated writes and unexpected fields', () => {
  assert.throws(() => proposedEyraWriteActions([call('project.list', {})], { project: true }), /non-write tool/);
  assert.throws(() => proposedEyraWriteActions([call('library.save_paper', { doi: '10.1234/a', title: 'A' })], { project: true }), /not authorized/);
  assert.throws(() => proposedEyraWriteActions([call('project.create', project), call('project.create', project)], { project: true }), /duplicate/);
  assert.throws(() => proposedEyraWriteActions([call('project.create', { ...project, user_id: 'another-user' })], { project: true }), /allowlisted schema/);
  assert.throws(() => proposedEyraWriteActions([call('project.create', { ...project, title: '' })], { project: true }), /needs a title/);
});

test('paper preview validates DOI syntax but does not misrepresent Crossref verification', () => {
  const proposed = proposedEyraWriteActions([call('library.save_paper', {
    doi: '10.1234/abc', title: 'Metadata from provider',
  })], { paper: true });
  assert.deepEqual(proposed, [{ tool: 'library.save_paper', fields: { doi: '10.1234/abc', title: 'Metadata from provider' } }]);
  assert.throws(() => proposedEyraWriteActions([call('library.save_paper', {
    doi: 'invalid', title: 'Metadata from provider',
  })], { paper: true }), /valid DOI syntax/);
});

test('API opt-in preview never enters tool execution loop or writes a durable agent action', () => {
  const api = readFileSync(new URL('../api/eyra.js', import.meta.url), 'utf8');
  assert.match(api, /preview_write_actions === true/);
  assert.match(api, /!previewWrites && durableRunsEnabled/);
  assert.match(api, /if \(previewWrites\) \{/);
  assert.match(api, /write_proposals: proposals/);
  assert.match(api, /preview_only: true/);
  assert.match(api, /No record has been created or saved/);
  assert.ok(api.indexOf('if (previewWrites) {', api.indexOf('let result = await openAiResponse.json()')) <
    api.indexOf('for (let round = 0; round < 3; round += 1)'));
});
