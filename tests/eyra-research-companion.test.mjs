import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('research companion always clears loading and offers a visible retry after failure', async () => {
  const source = await readFile(new URL('../src/components/eyra/EyraResearchCompanion.jsx', import.meta.url), 'utf8');
  assert.match(source, /requestInProgress\.current = true/);
  assert.match(source, /catch \(cause\)[\s\S]*setError\(/);
  assert.match(source, /finally \{[\s\S]*requestInProgress\.current = false;[\s\S]*setLoading\(false\)/);
  assert.match(source, /role="alert"[\s\S]*Click EYRA Research Companion to retry/);
  assert.match(source, /disabled=\{loading\}/);
  assert.match(source, /promiseWithTimeout\(base44\.integrations\.Core\.InvokeLLM/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /15_000[\s\S]*controller\.abort\(\)/);
});
