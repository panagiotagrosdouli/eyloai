import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatEyraToolFailure,
  formatUnverifiedEyraToolAction,
  hasEyraWriteReceipt,
} from '../src/lib/eyra-tool-outcome.mjs';

const validRecordId = 'f6a2b2f3-3f8e-4e33-8eac-9f3c3cf5f152';

test('only persisted project and paper writes with verified UUID receipts count as saved', () => {
  assert.equal(hasEyraWriteReceipt({
    tool: 'project.create',
    status: 'succeeded',
    result: { id: validRecordId, verified: true },
  }), true);
  assert.equal(hasEyraWriteReceipt({
    tool: 'library.save_paper',
    status: 'succeeded',
    result: { id: validRecordId, verified: true },
  }), true);
});

test('missing, malformed, unverified, foreign-tool, or unconfirmed receipts cannot claim a saved write', () => {
  const cases = [
    { tool: 'project.create', status: 'succeeded', result: {} },
    { tool: 'project.create', status: 'succeeded', result: { id: validRecordId } },
    { tool: 'project.create', status: 'succeeded', result: { id: validRecordId, verified: false } },
    { tool: 'project.create', status: 'succeeded', result: { id: 'project-1', verified: true } },
    { tool: 'project.create', status: 'pending', result: { id: validRecordId, verified: true } },
    { tool: 'project.delete', status: 'succeeded', result: { id: validRecordId, verified: true } },
    { tool: 'PROJECT.CREATE', status: 'succeeded', result: { id: validRecordId, verified: true } },
    { tool: 'project.create', status: 'succeeded', result: { id: '00000000-0000-0000-0000-000000000000', verified: true } },
  ];

  for (const action of cases) assert.equal(hasEyraWriteReceipt(action), false);
});

test('unknown and missing tool outcomes are described as unconfirmed', () => {
  for (const action of [{ tool: 'project.create', status: 'pending' }, {}]) {
    assert.match(formatUnverifiedEyraToolAction(action), /Outcome not confirmed/);
  }

  assert.match(
    formatUnverifiedEyraToolAction({ tool: 'project.create', status: 'succeeded' }),
    /result details could not be verified/i,
  );
});

test('tool failures do not expose untrusted upstream error text', () => {
  const secretError = 'private paper text https://provider.example/?token=secret';
  const message = formatEyraToolFailure({
    tool: 'library.save_paper',
    status: 'failed',
    error: secretError,
  });

  assert.match(message, /library\.save_paper failed/);
  assert.doesNotMatch(message, /private paper text|provider\.example|secret/);
});
