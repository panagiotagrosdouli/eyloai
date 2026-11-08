import test from 'node:test';
import assert from 'node:assert/strict';

import { appPath, stripAppBase } from '../src/lib/auth/routePaths.js';

test('app paths respect a GitHub Pages base path', () => {
  assert.equal(appPath('/login', '/eyloai/'), '/eyloai/login');
  assert.equal(appPath('auth/callback', '/eyloai/'), '/eyloai/auth/callback');
});

test('app paths stay rooted on a custom-domain deployment', () => {
  assert.equal(appPath('/login', '/'), '/login');
  assert.equal(appPath('login', '/'), '/login');
});

test('stripAppBase removes only the configured path prefix', () => {
  assert.equal(stripAppBase('/eyloai/home', '/eyloai/'), '/home');
  assert.equal(stripAppBase('/eyloai', '/eyloai/'), '/');
  assert.equal(stripAppBase('/elsewhere/home', '/eyloai/'), '/elsewhere/home');
});

