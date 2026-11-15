import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { percentile, summarizeUxObservations } from '../src/lib/ux-observation-summary.mjs';

test('performance summaries exclude unsupported and invalid samples without inventing measurements', () => {
  assert.equal(percentile([100, 200, 300, 400], 0.5), 250);
  assert.equal(percentile([100, 200, 300, 400], 0.75), 325);
  assert.equal(percentile([null, undefined, NaN, Infinity, -3], 0.75), null);
  assert.equal(percentile([], 0.75), null);
  assert.equal(percentile([1], 3), null);
  const report = summarizeUxObservations([
    { route: '/home', width: 320, navigationMs: 400, lcpMs: null, cls: 0, inpMs: null, pageErrors: [] },
    { route: '/home', width: 390, navigationMs: 600, lcpMs: 1200, cls: null, inpMs: null, pageErrors: ['exception'] },
    { route: '/library', width: 390, navigationMs: 800, lcpMs: 1700, cls: 0.03, inpMs: null, pageErrors: [] },
    { route: '', navigationMs: 123 },
  ]);
  assert.equal(report.samples, 3);
  const home = report.routes.find(row => row.route === '/home');
  assert.deepEqual(home.viewportWidths, [320, 390]);
  assert.equal(home.metrics.navigationMs.median, 500);
  assert.equal(home.metrics.navigationMs.p75, 550);
  assert.equal(home.metrics.lcpMs.observed, 1);
  assert.equal(home.metrics.lcpMs.unavailable, 1);
  assert.equal(home.metrics.lcpMs.median, 1200);
  assert.equal(home.metrics.cls.observed, 1);
  assert.equal(home.metrics.cls.median, 0);
  assert.equal(home.metrics.inpMs.observed, 0);
  assert.equal(home.metrics.inpMs.median, null);
  assert.equal(home.browserErrors, 1);
  assert.match(report.mode, /not field Core Web Vitals/);
});

test('the opt-in UX suite separates raw observations, synthetic summaries and screenshots', () => {
  const suite = readFileSync(new URL('./e2e-eylo-2030.mjs', import.meta.url), 'utf8');
  assert.match(suite, /EYLO_E2E_ALLOW_SCREENSHOTS === '1'/);
  assert.match(suite, /artifactDir && allowScreenshots/);
  assert.match(suite, /ux-summary\.json/);
  assert.match(suite, /summarizeUxObservations\(observations\)/);
  assert.match(suite, /inpMs: null/);
  assert.match(suite, /pageErrors\.splice\(0\)/);
  assert.match(suite, /waitForTimeout\(500\)/);
  assert.match(suite, /supported\.includes\('layout-shift'\)/);
});
