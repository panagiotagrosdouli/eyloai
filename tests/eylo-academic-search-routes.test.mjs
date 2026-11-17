import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const publicDiscovery = readFileSync(new URL('../src/pages/PublicDiscovery.jsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const careers = readFileSync(new URL('../src/pages/Careers.jsx', import.meta.url), 'utf8');

test('EYLO /search is public while the authenticated research workspace remains available', () => {
  assert.match(app, /path="\/search" element=\{<PublicDiscovery \/>\}/);
  assert.match(app, /path="\/workspace\/literature-search" element=\{<Home searchOnly \/>\}/);
});

test('Academic discovery, researcher search, and PhD routes remain separate', () => {
  assert.match(app, /path="\/academics"/);
  assert.match(app, /path="\/find-phd" element=\{<Navigate to="\/careers\?q=PhD" replace \/>\}/);
  assert.match(publicDiscovery, /aria-label="EYLO academic search tools"/);
  assert.match(home, /aria-label="EYLO academic tools"/);
});

test('Public to workspace handoff preserves the current search parameters', () => {
  assert.match(app, /const \{ search \} = useLocation\(\);/);
  assert.match(app, /to=\{\{ pathname: workspacePath, search \}\}/);
});

test('PhD provider failures offer original sources without fabricating listings', () => {
  const links = readFileSync(new URL('../src/lib/phd-search-links.mjs', import.meta.url), 'utf8');
  assert.match(links, /www\.findaphd\.com\/phds\//);
  assert.match(links, /euraxess\.ec\.europa\.eu\/jobs\/search/);
  assert.match(careers, /href=\{phdLinks\.findaphd\}/);
  assert.match(careers, /href=\{phdLinks\.euraxess\}/);
});
