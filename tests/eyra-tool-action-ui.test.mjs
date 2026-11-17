import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('the authenticated command center requires per-request opt-in for the bounded workspace and research action path', () => {
  assert.match(source, /enable_project_tools: allowWorkspaceActions/);
  assert.match(source, /\[allowWorkspaceActions, setAllowWorkspaceActions\] = useState\(false\)/);
  assert.match(source, /Allow authorized workspace and research tools for this request/);
  assert.match(source, /tool_intent: content/);
  assert.match(source, /signal: controller\.signal/);
});

test('persisted action IDs survive invalid source-citation model prose', () => {
  assert.match(source, /if \(!citations\.valid\) throw Object\.assign\(/);
  assert.match(source, /actions: response\?\.actions \|\| \[\]/);
  assert.match(source, /formatEyraToolActions\(error\?\.actions\)/);
});

test('action status is tied to server-confirmed outcomes, not model predictions', () => {
  assert.match(source, /action\.status === 'succeeded' && action\.tool === 'project\.create'/);
  assert.match(source, /action\.status === 'succeeded' && action\.tool === 'library\.save_paper'/);
  assert.match(source, /response\?\.actions/);
});

test('workspace writes require a visible review step with edit, cancel and confirm controls', () => {
  assert.match(source, /requestedEyraWrites\(content\)/);
  assert.match(source, /setPendingWriteReview\(\{ content, writeIntent \}\)/);
  const review = readFileSync(new URL('../src/components/eyra/EyraWriteIntentReview.jsx', import.meta.url), 'utf8');
  assert.match(source, /<EyraWriteIntentReview/);
  assert.match(review, /aria-label="Review EYRA write request"/);
  assert.match(review, /aria-label="Edit pending EYRA write"/);
  assert.match(review, /aria-label="Cancel pending EYRA write"/);
  assert.match(review, /aria-label="Confirm and send EYRA write"/);
  assert.match(source, /onConfirm=\{\(\) => void sendMessage\(pendingWriteReview\.content, \{ writeConfirmed: true \}\)\}/);
  assert.match(review, /This confirms your requested intent only, not the exact record fields/);
  assert.match(source, /write_confirmed: allowWorkspaceActions && writeConfirmed/);
});
