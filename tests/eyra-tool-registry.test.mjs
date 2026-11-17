import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_TOOLS } from '../server/eyra-tool-registry.mjs';

test('all EYRA tools are uniquely named strict functions with closed argument shapes', () => {
  assert.ok(PROJECT_TOOLS.length > 10);
  assert.equal(new Set(PROJECT_TOOLS.map(tool => tool.name)).size, PROJECT_TOOLS.length);
  for (const tool of PROJECT_TOOLS) {
    assert.equal(tool.type, 'function');
    assert.equal(tool.strict, true, tool.name);
    assert.match(tool.name, /^[a-z]+(?:\.[a-z_]+)+$/);
    assert.equal(tool.parameters.type, 'object', tool.name);
    assert.equal(tool.parameters.additionalProperties, false, tool.name);
    assert.deepEqual(new Set(tool.parameters.required), new Set(Object.keys(tool.parameters.properties)), tool.name);
  }
});

test('only explicitly reviewed write tools are exposed by the existing registry', () => {
  const writers = PROJECT_TOOLS.filter(tool => /\.(create|save|update|delete|send|archive|publish|cancel|execute)/.test(tool.name));
  assert.deepEqual(writers.map(tool => tool.name).sort(), ['library.save_paper', 'project.create']);
  assert.equal(PROJECT_TOOLS.some(tool => tool.name.includes('service_role')), false);
});
