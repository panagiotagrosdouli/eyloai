import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../src/components/dashboard/EyraHome.jsx');
const tools = read('../src/pages/ProductTools.jsx');
const crumbs = read('../src/components/layout/WorkspaceBreadcrumbs.jsx');
const app = read('../src/App.jsx');

test('home uses real research and EYRA entry points without simulated completion', () => {
  assert.match(home, /CustomEvent.*eylo:open-eyra/);
  assert.match(home, /eylo:open-eyra/);
  assert.match(home, /Continue with EYRA/);
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

test('review and gap filters preserve explicit evidence records', () => {
  const review = read('../src/pages/LiteratureReview.jsx');
  const gaps = read('../src/pages/ResearchGaps.jsx');
  for (const term of ['visiblePapers', 'screeningQuery', 'screeningFilter', 'Filter publication list by status', 'filters change only this list']) {
    assert.ok(review.toLowerCase().includes(term.toLowerCase()), 'review filtering contract: ' + term);
  }
  for (const term of ['visibleSourcePapers', 'savedPaperQuery', 'savedPaperFilter', 'Search does not discard hidden selections', 'Your selected evidence is preserved']) {
    assert.ok(gaps.includes(term), 'gap evidence filtering contract: ' + term);
  }
});
test('Escape closes mobile navigation and returns focus to its toggle', () => {
  const layout = read('../src/components/layout/AppLayout.jsx');
  assert.match(layout, /event\.key === 'Escape'/);
  assert.match(layout, /setMobileOpen\(false\); mobileToggleRef\.current\?\.focus\(\)/);
});
