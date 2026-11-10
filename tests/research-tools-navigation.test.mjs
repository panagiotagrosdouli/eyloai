import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nav = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const landscape = readFileSync(new URL('../src/pages/ResearchBattlefield.jsx', import.meta.url), 'utf8');

test('all ten research tools remain navigable without Experimental claims', () => {
  const routes = [
    '/challenges', '/briefing', '/radar',
    '/labs/research-landscape', '/labs/impact', '/labs/scenario',
    '/labs/team', '/labs/voice', '/grant-builder', '/pitchdeck',
  ];
  for (const route of routes) {
    assert.ok(nav.includes(`path: '${route}'`), `Missing route ${route}`);
  }
  for (const route of routes.slice(3, 8)) {
    const line = nav.split('\n').find(text => text.includes(`path: '${route}'`));
    assert.ok(line, `Missing navigation item ${route}`);
    assert.doesNotMatch(line, /Experimental/, `Outdated Experimental badge ${route}`);
  }
});

test('research landscape distinguishes failed providers from empty scholarly results', () => {
  assert.match(landscape, /Promise\.allSettled\(/);
  assert.match(landscape, /throwOnError: true/);
  assert.match(landscape, /Partial research coverage/);
  assert.match(landscape, /Missing results must not be interpreted as absence of research/);
  assert.doesNotMatch(landscape, /Funding: <span className="text-primary font-medium">Grants\.gov<\/span>/);
});
