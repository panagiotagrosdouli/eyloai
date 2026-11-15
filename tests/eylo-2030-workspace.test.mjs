import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('workspace hub stays protected, lazy, and preserves legacy project routes', () => {
  const routes = read('../src/App.jsx');
  assert.match(routes, /const WorkspaceHub = lazy\(/);
  for (const path of ['/workspace', '/projects', '/projects/:id', '/tools', '/workspace/search']) {
    assert.ok(routes.includes('path="' + path + '"'), path + ' remains available');
  }
  assert.match(routes, /<ProtectedRoute\s*\/>/);
  const hub = read('../src/pages/WorkspaceHub.jsx');
  for (const path of ['/projects', '/notes', '/library', '/files', '/life', '/calendar']) {
    assert.ok(hub.includes("path: '" + path + "'"), path + ' is available from Workspace');
  }
});

test('mobile directory retains focus and interaction while open', () => {
  const layout = read('../src/components/layout/AppLayout.jsx');
  assert.match(layout, /ref=\{mobileToolsRef\}/);
  assert.match(layout, /!mobileToolsRef\.current\?\.contains\(event\.target\)/);
  assert.match(layout, /aria-controls="mobile-tool-directory"/);
  assert.match(layout, /id="mobile-tool-directory"/);
  assert.match(layout, /id="workspace-mobile-menu"/);
});

test('command center navigates to real indexed workspace results and registered tools', () => {
  const command = read('../src/components/layout/GlobalCommandCenter.jsx');
  const search = read('../src/pages/UniversalSearch.jsx');
  const directory = read('../src/pages/ProductTools.jsx');
  const catalog = read('../src/lib/product-registry.mjs');
  assert.match(command, /\/workspace\/search\?q=/);
  assert.match(search, /searchParams\.get\('q'\)/);
  assert.match(search, /searchWorkspaceSource\(/);
  assert.match(command, /previousFocusRef\.current\.focus\(\)/);
  assert.match(command, /PRODUCT_TOOLS\.map\(tool/);
  assert.match(command, /getProductToolPath\(tool\)/);
  assert.match(directory, /getProductToolPath\(item\)/);
  assert.match(catalog, /export function getProductToolPath/);
});

test('home does not mount its secondary dashboard until requested', () => {
  const home = read('../src/pages/Home.jsx');
  const hero = read('../src/components/dashboard/EyraHome.jsx');
  assert.match(home, /workspaceExpanded\s*&&/);
  assert.match(home, /onToggle=\{event => setWorkspaceExpanded/);
  assert.match(hero, /autoRefine=\{false\}/);
  assert.doesNotMatch(hero, /<main\b/);
});
