import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('authenticated primary navigation is goal-first without losing EYRA and tools', () => {
  const navigation = layout.match(/const PRIMARY_NAV = \[([\s\S]*?)\];/)?.[1];
  assert.ok(navigation, 'primary navigation should be declared');
  for (const label of ['Home', 'Discover', 'My workspace', 'Learn']) {
    assert.match(navigation, new RegExp("label: '" + label + "'"));
  }
  assert.equal((navigation.match(/path:/g) || []).length, 4);
  assert.match(layout, /Ask EYRA/);
  assert.match(layout, /All tools/);
  assert.match(layout, /TOOL_GROUPS/);
  assert.match(layout, /grid-cols-5 items-end/);
});

test('protected legacy workflow deep links remain declared', () => {
  const required = ['/home', '/search', '/projects', '/library', '/notes', '/files', '/learn', '/study-planner', '/opportunities', '/research-gaps', '/literature-review', '/labs/data', '/knowledge-graph', '/meetings', '/grant-builder', '/tools/:tool'];
  for (const path of required) {
    assert.ok(routes.includes('path="' + path + '"'), 'missing route: ' + path);
  }
});

test('authenticated surface has dark-home tokens and focus treatment', () => {
  assert.match(css, /:root\.dark \.eylo-home,/);
  assert.match(css, /:root\.dark \.eylo-home-layout/);
  assert.match(css, /--eylo-radius-control:/);
  assert.match(css, /\.eylo-app-canvas :where\(button, \[role='button'\], a\):focus-visible/);
});
