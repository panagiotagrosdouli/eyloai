import test from 'node:test';
import assert from 'node:assert/strict';
import { executeProjectTool } from '../server/eyra-tool-executor.mjs';

test('executor rejects unknown and over-privileged tool calls without network access', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network call'); };
  try {
    await assert.rejects(() => executeProjectTool('projects.delete', '{}', {}), /Unsupported/);
    await assert.rejects(() => executeProjectTool('project.create', '{"title":"x"}', {}), /allowlisted/);
    await assert.rejects(() => executeProjectTool('research.search_publications', '{"query":"x"}', {}), /3–180/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
