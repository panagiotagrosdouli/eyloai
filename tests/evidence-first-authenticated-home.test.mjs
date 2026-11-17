import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('authenticated home is a distinct evidence-first dashboard, not a marketing mock', () => {
  const page = read('components/dashboard/EyraHome.jsx');
  const app = read('App.jsx');
  assert.match(app, /path="\/home" element=\{<Home \/>}/);
  assert.match(page, /Find the evidence\./);
  assert.match(page, /Keep the context\./);
  assert.match(page, /aria-label="Research assistant and continuation"/);
  assert.match(page, /aria-label="Common starting actions"/);
  assert.match(page, /to="\/search"/);
  assert.match(page, /to="\/start"/);
  assert.match(page, /href: '\/library'/);
  assert.match(page, /href: '\/projects\?new=1'/);
  assert.match(page, /Browse all tools/);
});

test('saved continuation is owner-scoped on the first render after account switch', () => {
  const page = read('components/dashboard/EyraHome.jsx');
  assert.match(page, /const ownerId = authUser\?\.id \?\? null/);
  assert.match(page, /workspaceState\.ownerId === ownerId \? workspaceState\.profile : null/);
  assert.match(page, /setWorkspaceState\(\{ ownerId, profile: null, loaded: false, error: false \}\)/);
  assert.match(page, /if \(active\) setWorkspaceState/);
  assert.match(page, /\[ownerId, loadAttempt\]/);
  assert.match(page, /projects\[0\]\.title \|\| 'Untitled project'/);
  assert.match(page, /No active project saved yet/);
  assert.match(page, /Your projects could not be loaded/);
  assert.doesNotMatch(page, /Sustainable cities|AI in healthcare|Learning and equity/);
});

test('EYRA configuration is not presented as proven provider availability', () => {
  const page = read('components/dashboard/EyraHome.jsx');
  assert.match(page, /AI configured does not guarantee a live response/);
  assert.match(page, /Topic analysis may use EYRA/);
  assert.match(page, /disabled=\{!eyraReady\}/);
  assert.match(page, /eylo:open-eyra/);
  assert.match(page, /Discover works without EYRA/);
});

test('real mobile browser fixture visits signed-in /home and tests overflow', () => {
  const e2e = readFileSync(new URL('./e2e-learning-integration.mjs', import.meta.url),'utf8');
  assert.match(e2e, /Signed-in Home mobile overflow/);
  assert.match(e2e, /signed-in-evidence-first-home-mobile/);
  assert.match(e2e, /PASS fixture: evidence-first signed-in Home/);
});
