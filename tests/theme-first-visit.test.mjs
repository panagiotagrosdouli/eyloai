import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasChosenTheme } from '../src/lib/preferences.js';

function withBrowserPreference(value, callback) {
  const previous = globalThis.window;
  globalThis.window = { localStorage: { getItem: () => value } };
  try { callback(); }
  finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test('first visit asks for a mode; saved light/dark/system choices are respected', () => {
  withBrowserPreference(null, () => assert.equal(hasChosenTheme(), false));
  for (const theme of ['light', 'dark', 'system']) {
    withBrowserPreference(JSON.stringify({ theme }), () => assert.equal(hasChosenTheme(), true));
  }
  withBrowserPreference(JSON.stringify({ language: 'el' }), () => assert.equal(hasChosenTheme(), false));
  withBrowserPreference('{invalid json', () => assert.equal(hasChosenTheme(), false));
});

test('appearance selection uses canonical preferences without blocking navigation', () => {
  const chooser = readFileSync(new URL('../src/components/marketing/ThemeWelcomeChoice.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../src/lib/theme.js', import.meta.url), 'utf8');
  const toggle = readFileSync(new URL('../src/components/marketing/ThemeToggle.jsx', import.meta.url), 'utf8');
  assert.match(chooser, /savePreferences\(\{ theme \}\)/);
  assert.match(chooser, /subscribePreferences/);
  assert.match(chooser, /select\('light'\)/);
  assert.match(chooser, /select\('dark'\)/);
  assert.match(chooser, /select\('system'\)/);
  assert.match(chooser, /aria-label="Choose appearance later"/);
  assert.match(app, /<ThemeWelcomeChoice \/>/);
  assert.match(theme, /root\.style\.colorScheme/);
  assert.match(theme, /meta\[name="theme-color"\]/);
  assert.match(toggle, /savePreferences\(\{ theme: dark \? "light" : "dark" \}\)/);
});
