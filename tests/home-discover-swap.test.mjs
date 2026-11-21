import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const breadcrumbs = readFileSync(new URL('../src/components/layout/WorkspaceBreadcrumbs.jsx', import.meta.url), 'utf8');
const publicSearch = readFileSync(new URL('../src/pages/PublicDiscovery.jsx', import.meta.url), 'utf8');

test('Home restores the existing private dashboard; Discover restores public scholarly search', () => {
  const nav = layout.match(/const PRIMARY_NAV = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(nav, /label: 'Home', path: '\/home', icon: Home/);
  assert.match(nav, /label: 'Discover', path: '\/search', icon: Search/);
  assert.match(app, /path="\/home" element=\{<Home \/>\}/);
  assert.match(app, /path="\/search" element=\{<PublicDiscovery \/>\}/);
});

test('Home links, signed-in entry, logo and breadcrumbs use the original dashboard destination', () => {
  assert.match(layout, /<Link to="\/home" className="mr-3/);
  assert.match(breadcrumbs, /<Link to="\/home".*>Home<\/Link>/);
  assert.match(app, /const PublicEntry = \(\{ children, workspacePath = '\/home' \}\)/);
  assert.doesNotMatch(publicSearch, /<Link to="\/home"[^>]*>Discover<\/Link>/);
  assert.match(publicSearch, /const \{ status: authStatus, user, initializeAuth \} = useAuth\(\)/);
});

test('Existing discovery aliases, EYRA workflows and other routes are kept intact', () => {
  assert.match(app, /path="\/discover"/);
  assert.match(app, /path="\/workspace\/literature-search"/);
  assert.match(app, /path="\/academics"/);
  assert.match(app, /path="\/find-phd"/);
  assert.match(app, /path="\/projects"/);
  assert.match(layout, /label: 'My workspace', path: '\/projects'/);
  assert.match(layout, /label: 'Learn', path: '\/learn'/);
});
