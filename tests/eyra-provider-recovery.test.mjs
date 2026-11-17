import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eyraProviderRecoveryNotice } from '../src/lib/eyra-provider-recovery.mjs';

test('EYRA quota failures direct people to independent research without leaking provider details', () => {
  const notice = eyraProviderRecoveryNotice({ code: 'OPENAI_QUOTA_EXHAUSTED', status: 503, message: 'secret password' });
  assert.equal(notice.title, 'EYRA AI credits are unavailable');
  assert.match(notice.message, /administrator.*billing/);
  assert.doesNotMatch(notice.message, /secret|password/);
});

test('rate limits honor bounded retry hints and require an explicit next action', () => {
  const limited = eyraProviderRecoveryNotice({ code: 'OPENAI_RATE_LIMITED', status: 503, retryAfterSeconds: 14 });
  assert.match(limited.message, /14 seconds/);
  assert.match(eyraProviderRecoveryNotice({ status: 429 }).message, /rate-limited/);
  assert.doesNotMatch(eyraProviderRecoveryNotice({ status: 429, message: 'key_123' }).message, /key_123/);
  assert.equal(eyraProviderRecoveryNotice({ code: 'EYRA_UNSUPPORTED_CITATION' }), null);
  assert.equal(eyraProviderRecoveryNotice({ code: 'PLAN_LIMIT_REACHED', status: 429 }).title, 'EYRA plan limit reached');
  assert.match(eyraProviderRecoveryNotice({ code: 'OPENAI_NOT_CONFIGURED' }).message, /administrator/);
});

test('EYRA provider recovery is account-scoped, accessible and never silently resends a paid request', () => {
  const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  assert.match(ui, /const \[providerNotice, setProviderNotice\] = useState\(null\)/);
  assert.match(ui, /setUserName\(''\); setActionError\(''\); setProviderNotice\(null\)/);
  assert.match(ui, /setProviderNotice\(eyraProviderRecoveryNotice\(error\)\)/);
  assert.match(ui, /role="status" aria-label="EYRA provider recovery"/);
  assert.match(ui, /to="\/search" onClick=\{onClose\}/);
  assert.match(ui, /Browse publications without AI/);
  assert.match(ui, /if \(controller\.signal\.aborted\) return/);
  assert.doesNotMatch(ui, /setTimeout\(\(\) => sendMessage/);
});
