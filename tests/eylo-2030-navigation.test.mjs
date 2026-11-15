import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('EYLO 2030 keeps goal-first navigation with access to the existing tool directory', () => {
  const layout = read('../src/components/layout/AppLayout.jsx');
  for (const goal of ['Home', 'Discover', 'Workspace', 'Create', 'Learn']) {
    assert.match(layout, new RegExp("label: '" + goal + "'"));
  }
  assert.match(layout, /path: '\/tools'/);
  assert.match(layout, /ref=\{mobileToolsRef\}/);
  assert.match(layout, /!mobileToolsRef\.current\?\.contains\(event\.target\)/);
  assert.match(layout, /aria-controls="mobile-tool-directory"/);
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /id="main-content"/);
});

test('existing authenticated routes and lazy-loading remain intact', () => {
  const routes = read('../src/App.jsx');
  for (const path of ['/home', '/workspace', '/search', '/projects', '/documents/new', '/learn', '/tools', '/workspace/search', '/literature-review', '/grant-builder']) {
    assert.ok(routes.includes('path="' + path + '"'), path + ' remains registered');
  }
  assert.match(routes, /const Home = lazy\(/);
  assert.match(routes, /<ProtectedRoute\s*\/>/);
});

test('home quick starts are actual route handoffs, never simulated completions', () => {
  const home = read('../src/components/dashboard/EyraHome.jsx');
  for (const path of ['/search', '/library', '/projects', '/literature-review', '/quiz-generator', '/opportunities']) {
    assert.ok(home.includes("href: '" + path + "'"), path + ' discoverable');
  }
  assert.match(home, /autoRefine=\{false\}/);
  const route = read('../src/pages/Home.jsx');
  assert.match(route, /runEyraDiscovery\(/);
});

test('command search forwards the query to the authorized shared search service', () => {
  const command = read('../src/components/layout/GlobalCommandCenter.jsx');
  const search = read('../src/pages/UniversalSearch.jsx');
  assert.match(command, /\/workspace\/search\?q=/);
  assert.match(search, /searchParams\.get\('q'\)/);
  assert.match(search, /searchWorkspaceSource\(/);
  assert.match(command, /previousFocusRef\.current\.focus\(\)/);
  assert.match(command, /PRODUCT_TOOLS\.map\(tool/);
  assert.match(command, /getProductToolPath\(tool\)/);
});

test('product directory filters actual registry entries rather than duplicating tools', () => {
  const tools = read('../src/pages/ProductTools.jsx');
  assert.match(tools, /PRODUCT_TOOLS\.filter\(/);
  assert.match(tools, /visibleTools\.map\(/);
  assert.match(tools, /No tools match your search/);
  assert.match(tools, /getProductToolPath\(p\)/);
  const catalog = read('../src/lib/product-registry.mjs');
  assert.match(catalog, /export function getProductToolPath/);
});
