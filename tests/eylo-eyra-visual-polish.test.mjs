import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('both EYLO and EYRA logos are code-drawn and never use the black bitmap background', () => {
  const brand = source('components/brand/BrandLogo.jsx');
  assert.match(brand, /function ResearchMark\(/);
  assert.match(brand, /<svg /);
  assert.match(brand, /<linearGradient /);
  assert.match(brand, /<radialGradient /);
  assert.match(brand, /role=\{decorative \? undefined : 'img'\}/);
  assert.match(brand, /EYRA research assistant/);
  assert.doesNotMatch(brand, /brand\/eyra\.png|bg-\[#050712\]|object-cover/);
  assert.match(brand, /export function EyraOrb/);
});

test('all-tools menu defaults to curated shortcuts but still searches the full directory', () => {
  const layout = source('components/layout/AppLayout.jsx');
  assert.match(layout, /const FEATURED_TOOL_PATHS = new Set\(/);
  assert.match(layout, /const FEATURED_TOOL_GROUPS = TOOL_GROUPS/);
  assert.match(layout, /const visibleGroups = filterToolGroups\(TOOL_GROUPS, toolQuery\)/);
  assert.match(layout, /const menuGroups = toolQuery\.trim\(\) \? visibleGroups : FEATURED_TOOL_GROUPS/);
  assert.match(layout, /Browse complete directory/);
  assert.match(layout, /role="region" aria-label="All tools quick finder"/);
  assert.match(layout, /max-h-\[min\(52dvh,370px\)\]/);
  assert.match(layout, /aria-expanded=\{toolsOpen\}/);
  assert.match(layout, /id="mobile-tool-directory"/);
  assert.match(layout, /<EyraCommandCenter open=\{eyraOpen\}/);
});

test('home prioritizes research search and presents owner-isolated work in a responsive grid', () => {
  const home = source('components/dashboard/EyraHome.jsx');
  assert.match(home, /max-w-\[1440px\]/);
  assert.match(home, /grid gap-6 lg:grid-cols-2/);
  assert.match(home, /lg:col-span-2/);
  assert.match(home, /const seenQueries = new Set\(\)/);
  assert.match(home, /seenQueries\.has\(query\.toLocaleLowerCase\(\)\)/);
  assert.match(home, /visibleOwnerProfileState\(profileState, ownerId\)/);
  assert.match(home, /onSearch\(homeQuery\.trim\(\)\)/);
  assert.match(home, /eylo:open-eyra/);
  for (const route of ['/search', '/library', '/projects?new=1', '/study-planner']) {
    assert.ok(home.includes(route), 'missing original functional route ' + route);
  }
});

test('EYRA composer and secondary history tools remain functional and accessible', () => {
  const ui = source('components/eyra/EyraCommandCenter.jsx');
  const composer = source('components/eyra/EyraComposer.jsx');
  assert.match(ui, /aria-modal="true"/);
  assert.match(ui, /aria-labelledby="eyra-dialog-title"/);
  assert.match(ui, /History &amp; tools/);
  assert.match(ui, /onClick=\{exportConversation\}/);
  assert.match(ui, /<EyraAgentRunHistory/);
  assert.match(ui, /<EyraWriteIntentReview/);
  assert.match(ui, /onChange=\{event => \{ setAllowWorkspaceActions\(event\.target\.checked\)/);
  assert.match(composer, /aria-label="Message EYRA"/);
  assert.match(composer, /aria-label="Send message"/);
  assert.match(composer, /onStartListening/);
  assert.match(composer, /disabled=\{!value\.trim\(\) \|\| loading\}/);
});
