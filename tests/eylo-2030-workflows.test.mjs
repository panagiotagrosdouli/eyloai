import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../src/components/dashboard/EyraHome.jsx');
const tools = read('../src/pages/ProductTools.jsx');
const crumbs = read('../src/components/layout/WorkspaceBreadcrumbs.jsx');
const app = read('../src/App.jsx');

test('home uses real research and EYRA entry points without simulated completion', () => {
  assert.match(home, /onSearch\(homeQuery\.trim\(\)\)/);
  assert.match(home, /eylo:open-eyra/);
  assert.match(home, /Start researching/);
  assert.match(home, /Find research funding/);
  assert.match(home, /View all tools/);
  assert.match(home, /profile\?\.tasks/);
  assert.match(home, /No upcoming deadlines/);
  assert.doesNotMatch(home, /Your research,<br/);
});

test('directory contains major research and workspace workflows and a keyboard-accessible search field', () => {
  for (const path of ['/search', '/projects', '/library', '/study-planner', '/opportunities', '/research-gaps', '/literature-review', '/labs/data', '/knowledge-graph', '/grant-builder', '/meetings', '/notes', '/files', '/labs/voice']) {
    assert.ok(tools.includes("href: '" + path + "'"), 'missing directory destination: ' + path);
    assert.ok(app.includes('path="' + path + '"'), 'directory destination does not have a protected route: ' + path);
  }
  assert.match(tools, /type="search"/);
  assert.match(tools, /aria-pressed=\{category === name\}/);
  assert.match(tools, /No tools found/);
  assert.match(tools, /PRODUCT_TOOLS\.map/);
});

test('breadcrumb navigation has a current-page indication and a Home return link', () => {
  assert.match(crumbs, /aria-label="Breadcrumb"/);
  assert.match(crumbs, /aria-current="page"/);
  assert.match(crumbs, /to="\/home"/);
});
