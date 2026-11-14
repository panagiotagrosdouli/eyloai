import test from 'node:test';
import assert from 'node:assert/strict';
import { loadExactLifeTask, TASK_TARGET_ERROR } from '../src/lib/life-task-target.mjs';
const id = '40000000-0000-4000-8000-000000009999';
test('exact task lookup retains its identity and expected owner instead of substituting a recent task', async () => {
  const calls = [];
  const task = await loadExactLifeTask({ repository: { get: async (...args) => { calls.push(args); return { id, title: 'Older saved task' }; } }, id, ownerId: 'owner-a' });
  assert.equal(task.id, id);
  assert.deepEqual(calls, [[id, 'owner-a']]);
});
test('malformed targets and missing identity cannot make a repository request', async () => {
  let calls = 0;
  const repository = { get: async () => { calls += 1; } };
  for (const target of ['', '../foreign', 'x'.repeat(10000)]) await assert.rejects(loadExactLifeTask({ repository, id: target, ownerId: 'owner-a' }), { message: TASK_TARGET_ERROR });
  await assert.rejects(loadExactLifeTask({ repository, id, ownerId: '' }), { message: TASK_TARGET_ERROR });
  assert.equal(calls, 0);
});
test('foreign/missing/mismatched records and private upstream errors use the same closed error', async () => {
  for (const get of [async () => null, async () => ({ id: 'different' }), async () => { throw new Error('Private upstream detail'); }]) {
    await assert.rejects(loadExactLifeTask({ repository: { get }, id, ownerId: 'owner-a' }), { message: TASK_TARGET_ERROR });
  }
});
