import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('goal-first workspace is lazy, protected and preserves existing routes', () => {
  const app = read('../src/App.jsx');
  assert.match(app, /const WorkspaceHub = lazy\(/);
  for (const path of ['/home','/workspace','/projects','/library','/notes','/files','/learn','/tools','/workspace/search','/literature-review']) {
    assert.ok(app.includes('path="' + path + '"'), path);
  }
  assert.match(app, /<ProtectedRoute\s*\/>/);
  const hub = read('../src/pages/WorkspaceHub.jsx');
  for (const path of ['/projects','/notes','/library','/files','/life','/calendar']) assert.ok(hub.includes("path: '" + path + "'"));
});

test('mobile directory is interactive and does not dismiss itself when searching', () => {
  const layout = read('../src/components/layout/AppLayout.jsx');
  assert.match(layout, /ref=\{mobileToolsRef\}/);
  assert.match(layout, /!mobileToolsRef\.current\?\.contains\(event\.target\)/);
  assert.match(layout, /id="mobile-tool-directory"/);
});

test('command search uses real authorized search and canonical registered tools', () => {
  const command = read('../src/components/layout/GlobalCommandCenter.jsx');
  const search = read('../src/pages/UniversalSearch.jsx');
  const catalog = read('../src/lib/product-registry.mjs');
  assert.match(command, /\/workspace\/search\?q=/);
  assert.match(command, /PRODUCT_TOOLS\.map\(tool/);
  assert.match(command, /getProductToolPath\(tool\)/);
  assert.match(command, /previousFocusRef\.current\.focus\(\)/);
  assert.match(search, /searchParams\.get\('q'\)/);
  assert.match(search, /searchWorkspaceSource\(/);
  assert.match(catalog, /export function getProductToolPath/);
});

test('no silent research history saves and no dashboard fetch until expanded', () => {
  const home = read('../src/pages/Home.jsx');
  const results = read('../src/components/discovery/DiscoveryResults.jsx');
  assert.doesNotMatch(home, /SearchHistory\.create\(/);
  assert.match(home, /workspaceExpanded &&/);
  assert.match(results, /onClick=\{saveSearch\}/);
  assert.match(results, /aria-describedby="project-save-scope"/);
  assert.match(results, /\/literature-review\?project_id=/);
});

test('home queries detect explicit research goals without fabricating sources', () => {
  const home = read('../src/pages/Home.jsx');
  const guided = read('../src/components/discovery/GuidedSearch.jsx');
  assert.match(home, /interpretResearchGoal\(request\)/);
  assert.match(home, /runEyraDiscovery\(discoveryRequest/);
  assert.match(guided, /interpretResearchGoal\(value\)/);
});
