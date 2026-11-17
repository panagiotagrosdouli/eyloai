import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  approvedEyraWritesEnabled, sealEyraWriteProposal, verifyEyraWriteApproval,
} from '../server/eyra-field-approval.mjs';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request = 'Create a project for a reproducibility audit';
const proposal = {
  tool: 'project.create',
  fields: { title: 'Audit', description: 'Reviewed', goal: '', milestones: '', tasks: '' },
};
const keys = ['EYRA_FIELD_APPROVAL_ENABLED', 'EYRA_DURABLE_RUNS_ENABLED', 'EYRA_WRITE_APPROVAL_SECRET'];
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
after(() => { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
function enable() {
  process.env.EYRA_FIELD_APPROVAL_ENABLED = 'true';
  process.env.EYRA_DURABLE_RUNS_ENABLED = 'true';
  process.env.EYRA_WRITE_APPROVAL_SECRET = 'fixture-secret-32-plus-characters-and-not-production';
}

test('field approval remains disabled until all three separate security gates are set', () => {
  for (const key of keys) delete process.env[key];
  assert.equal(approvedEyraWritesEnabled(), false);
  assert.throws(() => sealEyraWriteProposal({ ownerId: owner, request, proposal }), /not activated/);
  enable();
  assert.equal(approvedEyraWritesEnabled(), true);
  delete process.env.EYRA_DURABLE_RUNS_ENABLED;
  assert.equal(approvedEyraWritesEnabled(), false);
});

test('signed record proposals bind exact fields, verified owner and latest request for five minutes', () => {
  enable();
  const now = 1800000000000;
  const token = sealEyraWriteProposal({ ownerId: owner, request, proposal, now });
  const approved = verifyEyraWriteApproval(token, { ownerId: owner, request, now: now + 1 });
  assert.deepEqual(approved.proposal, proposal);
  assert.match(approved.id, /^[0-9a-f-]{36}$/);
  assert.throws(() => verifyEyraWriteApproval(token, { ownerId: foreign, request, now }), /does not belong/);
  assert.throws(() => verifyEyraWriteApproval(token, { ownerId: owner, request: 'Create another project', now }), /does not belong/);
  assert.throws(() => verifyEyraWriteApproval(token, { ownerId: owner, request, now: now + 300000 }), /expired/);
  assert.throws(() => verifyEyraWriteApproval(token, { ownerId: owner, request, now: now - 1 }), /expired/);
});

test('tampered signature or fields cannot authorize a different saved record', () => {
  enable();
  const token = sealEyraWriteProposal({ ownerId: owner, request, proposal });
  const [payload, signature] = token.split('.');
  const changed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  changed.fields.title = 'Changed without approval';
  const alteredPayload = Buffer.from(JSON.stringify(changed)).toString('base64url');
  assert.throws(() => verifyEyraWriteApproval(alteredPayload + '.' + signature, { ownerId: owner, request }), /signature/);
  assert.throws(() => verifyEyraWriteApproval(token + 'invalid', { ownerId: owner, request }), /signature/);
  assert.throws(() => sealEyraWriteProposal({ ownerId: owner, request, proposal: {
    ...proposal, fields: { ...proposal.fields, user_id: foreign },
  } }), /allowlisted schema/);
});
