import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const engine = readFileSync(new URL('../src/lib/eyra-engine.js', import.meta.url), 'utf8');

test('EYRA starts evidence analysis before waiting for Grants.gov', () => {
  const scholarlySourcesReady = engine.indexOf('const [paperBundle, researchers, institutions] = await Promise.all([');
  const analysisStarts = engine.indexOf('const generated = await generateEvidenceBasedAnalysis');
  const fundingWaits = engine.indexOf('const fundingResult = await fundingPromise;');

  assert.ok(scholarlySourcesReady >= 0);
  assert.ok(analysisStarts > scholarlySourcesReady);
  assert.ok(fundingWaits > analysisStarts);
  assert.doesNotMatch(engine.slice(scholarlySourcesReady, analysisStarts), /fundingPromise/);
});
