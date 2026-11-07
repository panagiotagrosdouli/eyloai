import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('EYLO uses one blue/navy brand palette for all application surfaces', () => {
  const styles = read('src/index.css');
  for (const color of ['#102b49', '#1d5f91', '#f8fafc', '#d9e3ec']) {
    assert.ok(styles.includes(color), `Missing academic palette token ${color}`);
  }
  assert.match(styles, /:root\.light\s*\{[\s\S]*--primary:\s*205 67% 34%/);
  assert.match(styles, /:root\.dark\s*\{[\s\S]*--primary:\s*203 70% 70%/);
  assert.match(styles, /\.eyra-gradient\s*\{\s*background:\s*linear-gradient\(120deg, var\(--eylo-blue-hover\), var\(--eylo-blue\)\)/);
});

test('Default blue preference keeps theme-aware colors without inline overrides', () => {
  const prefs = read('src/lib/preferences.js');
  assert.match(prefs, /prefs\.accent === 'blue'/);
  assert.match(prefs, /root\.style\.removeProperty\('--primary'\)/);
  assert.match(prefs, /root\.style\.removeProperty\('--ring'\)/);
});

test('Corporate landing uses a neutral Notion-inspired palette while discovery retains its established theme', () => {
  const landing = read('src/pages/Landing.jsx');
  const discovery = read('src/pages/PublicDiscovery.jsx');
  assert.match(landing, /#FAFAFA/);
  assert.match(landing, /#191919/);
  assert.match(landing, /Enter EYLO AI/);
  assert.match(discovery, /#102B49/);
});
