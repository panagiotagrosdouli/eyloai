import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('signed-in Home keeps evidence-first actions prominent and uses responsive layout', () => {
  const home = read('components/dashboard/EyraHome.jsx');
  assert.match(home, /Your research workspace/);
  assert.match(home, /What would you like to work on\?/);
  assert.match(home, /New to EYLO\? Start here\./);
  assert.match(home, /bg-gradient-to-br from-card via-card to-primary\/5/);
  assert.match(home, /onSearch\(homeQuery\.trim\(\)\)/);
  assert.match(home, /eylo:open-eyra/);
  assert.match(home, /disabled=\{!eyraReady\}/);
  assert.match(home, /visibleOwnerProfileState\(profileState, ownerId\)/);
  for (const target of ['/search', '/library', '/projects?new=1', '/study-planner', '/opportunities']) {
    assert.ok(home.includes(target), 'missing functional path: ' + target);
  }
});

test('workspace shell retains usable desktop and mobile navigation', () => {
  const layout = read('components/layout/AppLayout.jsx');
  assert.match(layout, /aria-label="Workspace navigation"/);
  assert.match(layout, /aria-label="Primary mobile navigation"/);
  assert.match(layout, /id="main-content"/);
  assert.match(layout, /<WorkspaceBreadcrumbs \/>/);
  assert.match(layout, /<EyraCommandCenter open=\{eyraOpen\}/);
  assert.match(layout, /focus-visible:outline/);
  assert.match(layout, /bg-card\/95 shadow-sm backdrop-blur-xl/);
});

test('signed-in tool directory has goal search, categories and distinct empty state', () => {
  const tools = read('pages/ProductTools.jsx');
  assert.match(tools, /Tool directory/);
  assert.match(tools, /aria-label="Browse EYLO tools"/);
  assert.match(tools, /type="search"/);
  assert.match(tools, /aria-pressed=\{category === name\}/);
  assert.match(tools, /No tools found/);
  assert.match(tools, /Show all tools/);
  assert.match(tools, /focus-visible:outline/);
  assert.match(tools, /matchesIntent\(item, query\)/);
});
