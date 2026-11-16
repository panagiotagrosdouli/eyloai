import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const breadcrumbs = readFileSync(new URL('../src/components/layout/WorkspaceBreadcrumbs.jsx', import.meta.url), 'utf8');
const publicSearch = readFileSync(new URL('../src/pages/PublicDiscovery.jsx', import.meta.url), 'utf8');

test('Home opens the existing EYLO search; Discover opens the existing workspace dashboard', () => {
  const nav = layout.match(/const PRIMARY_NAV = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(nav, /label: 'Home', path: '\/search', icon: Home/);
  assert.match(nav, /label: 'Discover', path: '\/home', icon: Search/);
  assert.match(app, /path="\/search" element=\{<PublicDiscovery \/>\}/);
  assert.match(app, /path="\/home" element=\{<Home \/>\}/);
});

test('Home navigation remains consistent across logo, breadcrumbs, and signed-in entry', () => {
  assert.match(layout, /<Link to="\/search" className="mr-3/);
  assert.match(breadcrumbs, /<Link to="\/search".*>Home<\/Link>/);
  assert.match(app, /const PublicEntry = \(\{ children, workspacePath = '\/search' \}\)/);
  assert.match(publicSearch, /authStatus === 'authenticated'/);
  assert.match(publicSearch, /<Link to="\/home".*>Discover<\/Link>/);
});

test('Existing discovery and EYRA analysis entry routes are not deleted by navigation rename', () => {
  assert.match(app, /path="\/discover"/);
  assert.match(app, /path="\/workspace\/literature-search"/);
  assert.match(app, /path="\/academics"/);
  assert.match(app, /path="\/find-phd"/);
});
