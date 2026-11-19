import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildResearchReport } from '../src/lib/research-report-export.mjs';

test('Opportunity Radar retries workspace errors without enabling scan for an anonymous owner', () => {
  const ui = readFileSync(new URL('../src/pages/OpportunityRadar.jsx', import.meta.url), 'utf8');
  assert.match(ui, /const \[contextLoading, setContextLoading\] = useState\(true\)/);
  assert.match(ui, /const \[contextError, setContextError\] = useState\(''\)/);
  assert.match(ui, /if \(!active\) return;/);
  assert.match(ui, /return \(\) => \{ active = false; \};/);
  assert.match(ui, /disabled=\{loading \|\| contextLoading \|\| Boolean\(contextError\) \|\| !user\}/);
  assert.match(ui, /role="alert"/);
  assert.match(ui, /Retry workspace connection/);
  assert.match(ui, /setContextRetry\(count => count \+ 1\)/);
});

test('report manifest does not misrepresent omitted source records as complete', () => {
  const report = JSON.parse(buildResearchReport({
    tool: 'voice-workspace',
    query: 'Research question',
    analysis: { summary: 'Provisional synthesis' },
    sources: Array.from({ length: 60 }, (_, i) => ({ id: 'W' + i, url: 'https://openalex.org/W' + i })),
  }));
  assert.equal(report.source_coverage.retrieved_total, 60);
  assert.equal(report.source_coverage.included, 40);
  assert.equal(report.source_coverage.omitted, 20);
  assert.equal(report.source_coverage.truncated, true);
  assert.equal(report.sources.length, 40);
});
